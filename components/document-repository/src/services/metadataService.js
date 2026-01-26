// This service handles metadata extraction, storage, and querying for uploaded documents.
// Extract metadata from uploaded files (e.g., filename, MIME type, size, create/upload dates, text content for PDFs/DOCX).
// Store metadata to ArangoDB.
// Search/query metadata by criteria (e.g., filename, file type, date range, etc.).
// Support metadata deletion when a file is deleted.
// Manually Updating existing metadata; Validating user-provided metadata (optional but helpful)

const fs = require('fs').promises; // For async file operations
const path = require('path');
const mime = require('mime-types'); // For MIME type detection
const { v4: uuidv4 } = require('uuid'); // For generating unique IDs
const { getPdfPageCount, getDocxWordCount, getTxtLineCount, getTxtWordCount, getFileHash } = require('../utils/fileUtils'); // Utility to ensure directory exists
const { logger } = require('../../shared-lib');
const { dbService } = require('../../shared-lib');


async function extractMetadata(filePath, fileInfo = {}) {
    const stats = await fs.stat(filePath);
    const mimeType = mime.lookup(filePath) || 'application/octet-stream';
    const baseMeta = {
        file_id: String(fileInfo.file_id || uuidv4()),
        file_name: fileInfo.file_name || path.basename(filePath),
        file_size: fileInfo.file_size || stats.size,
        file_type: fileInfo.file_type || mimeType,
        storage_path: fileInfo.storage_path || filePath,
        file_hash: fileInfo.file_hash || await getFileHash(filePath),
        labels: fileInfo.labels || [],
        author: fileInfo.author || '',
        upload_date: fileInfo.upload_date || new Date().toISOString(),
        create_date: fileInfo.create_date || stats.birthtime.toISOString(),
        crawl_date: fileInfo.crawl_date || '',
        source_url: fileInfo.source_url || '',
        language: fileInfo.language || 'unknown',
        chunk_count: 0,
        dataprep: {
            status: 'Pending', // Changed to capitalized 'Pending' per spec
            ingest_date: '',
            retract_date: ''
        }
    };

    return baseMeta;
}


class MetadataService {
    // 1. Extract and store metadata (one JSON file per document)
    async getDb() {
        return await dbService.getConnection('files');
    }

    async addMetadata(filePath, fileInfo = {}) {
        try {
            const metadata = await extractMetadata(filePath, fileInfo);
            
            // Save metadata to ArangoDB
            const db = await this.getDb();
            await db.collection('files').save(metadata);
            console.log(`Metadata for ${filePath} added successfully.`);
            return metadata; // Return the saved metadata
        } catch (error) {
            console.error(`Failed to add metadata for ${filePath}: ${error.message}`);
            throw error;
        }
    }

    // 2. Search/query metadata (by filename, MIME type, date range, etc.) by scanning all *_metadata.json files in uploads directory
    async searchMetadata(file_name, file_type, upload_date_from, upload_date_to, create_date_from, create_date_to, labels, author, status, language) {
        try {
            const db = await this.getDb();
            let query = `FOR file IN files`;
            const filters = [];
            const bindVars = {};

            if (file_name) {
                filters.push('CONTAINS(LOWER(file.file_name), LOWER(@file_name))');
                bindVars.file_name = file_name;
            }
            if (file_type) {
                filters.push('file.file_type == @file_type');
                bindVars.file_type = file_type;
            }
            if (upload_date_from) {
                filters.push('file.upload_date >= @upload_date_from');
                bindVars.upload_date_from = upload_date_from;
            }
            if (upload_date_to) {
                filters.push('file.upload_date <= @upload_date_to');
                bindVars.upload_date_to = upload_date_to;
            }
            if (create_date_from) {
                filters.push('file.create_date >= @create_date_from');
                bindVars.create_date_from = create_date_from;
            }
            if (create_date_to) {
                filters.push('file.create_date <= @create_date_to');
                bindVars.create_date_to = create_date_to;
            }
            if (labels && Array.isArray(labels) && labels.length > 0) {
                filters.push('LENGTH(INTERSECTION(file.labels, @labels)) > 0');
                bindVars.labels = labels;
            }
            if (author) {
                filters.push('file.author == @author');
                bindVars.author = author;
            }
            if (status) {
                filters.push('file.dataprep.status == @status');
                bindVars.status = status;
            }
            if (language) {
                filters.push('file.language == @language');
                bindVars.language = language;
            }

            if (filters.length > 0) { // Only add FILTER clause if there are filters
                query += ' FILTER ' + filters.join(' AND ');
            }
            query += ' SORT file.upload_date DESC RETURN file';

            logger.debug(`Searching metadata with query: ${query} and bindVars: ${JSON.stringify(bindVars)}`);

            const cursor = await db.query(query, bindVars);
            return await cursor.all();
        } catch (error) {
            console.error(`Failed to search metadata: ${error.message}`);
            throw error;
        }
    }

    // 3. Get metadata by file_id.
    async getMetadataById(file_id) {
        try {
            const db = await this.getDb();
            const cursor = await db.query(
                `FOR file IN files FILTER file.file_id == @file_id LIMIT 1 RETURN file`,
                { file_id }
            );
            return await cursor.next() || null; // Return the first matching metadata
        } catch (error) {
            console.error(`Failed to get metadata by ID: ${error.message}`);
            throw error;
        }
    }

    // 4. Delete metadata file by file_id (when a file is deleted)
    async deleteMetadata(file_id) {
        try {
            const db = await this.getDb();
            // Find the metadata by file_id
            const cursor = await db.query(
                `FOR file IN files FILTER file.file_id == @file_id LIMIT 1 RETURN file`,
                { file_id }
            );
            const metadata = await cursor.next();
            if (!metadata) {
                throw new Error(`Metadata not found for file_id: ${file_id}`);
            }
            await db.collection('files').remove(metadata._key);
            return true;
        } catch (error) {
            console.error(`Failed to delete metadata: ${error.message}`);
            throw error;
        }
    }

    // 5. update metadata after ingestion or retraction
    // This method can also be used to update metadata manually by the user.
    async updateMetadata(file_id, updates= {}) {
        try {
            const db = await this.getDb();
            const cursor = await db.query(
                `FOR file IN files FILTER file.file_id == @file_id LIMIT 1 RETURN file`,
                { file_id }
            );
            const metadata = await cursor.next();
            if (!metadata) {
                throw new Error(`Metadata not found for file_id: ${file_id}`);
            }

            // Update metadata with provided updates. Only update allowed fields.
            const allowedFields = ['dataprep', 'chunk_count'];

            const updateObj = {};
            for (const key of Object.keys(updates)) {
                if (allowedFields.includes(key)) {
                    // Special handling for labels: allow adding/removing labels
                    if (key === 'labels' && Array.isArray(updates[key])) {
                        updateObj.labels = updates.labels;
                    } 
                    else if (key === 'dataprep' && typeof updates.dataprep === 'object') {
                        // Special handling for dataprep: allow updating status, ingest_date, retract_date
                        updateObj.dataprep = {
                            ...metadata.dataprep,
                            ...updates[key]
                        };
                    }
                    else {
                        updateObj[key] = updates[key];
                    }
                }
            }
            if (Object.keys(updateObj).length === 0) {
                throw new Error('No valid fields to update');
            }
            // Update the metadata in the database
            await db.collection('files').update(metadata._key, updateObj);
            const updated = await db.collection('files').document(metadata._key);
            console.log(`Metadata (dataprep part) for file_id ${file_id} updated successfully.`);
            return updated;
        } catch (error) {
            console.error(`Failed to update metadata for file_id ${file_id}: ${error.message}`);
            throw error;
        }
    }
}

module.exports = new MetadataService();