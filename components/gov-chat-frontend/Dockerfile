# Use Node.js 22.14.0 as the base image
FROM node:22.14.0-alpine

# Set working directory
WORKDIR /app

# Copy package.json and install dependencies
COPY package.json package-lock.json ./
RUN npm install

# Copy the entire project
COPY . .

# Expose the port the Vue app runs on
EXPOSE 8090

# Start the Vue.js development server
CMD ["npm", "run", "serve"]

