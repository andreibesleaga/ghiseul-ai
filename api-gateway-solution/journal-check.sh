#!/bin/bash

# Create output directory
OUTPUT_DIR="security_scan_$(date +%Y%m%d_%H%M%S)"
mkdir -p "$OUTPUT_DIR"

echo "Starting security scan of journald logs..."
echo "Results will be saved to: $OUTPUT_DIR/"
echo "---------------------------------------"

# Function to run a query and save results
check_logs() {
    local description="$1"
    local query="$2"
    local outfile="$OUTPUT_DIR/$(echo "$description" | tr ' ' '_' | tr -d '()').log"
    
    echo -e "\n\033[1;34m==== $description ====\033[0m"
    echo "==== $description ====" > "$outfile"
    
    # Run query and capture results
    local results=$(eval "$query" 2>/dev/null)
    
    # Save to file
    echo "$results" >> "$outfile"
    
    # Count entries
    local count=$(echo "$results" | grep -v "^$" | wc -l)
    
    echo -e "\033[1;33mFound $count entries\033[0m"
    
    # If there are entries, output a sample to console
    if [ "$count" -gt 0 ]; then
        echo -e "\033[0;36mSample entries (max 5):\033[0m"
        echo "$results" | head -n 5
        if [ "$count" -gt 5 ]; then
            echo -e "\033[0;36m... (see $outfile for complete results)\033[0m"
        fi
        echo -e "\033[0;36m---------------------------------\033[0m"
    fi
}

# Function to extract unique IP addresses from a file
extract_ips() {
    local file="$1"
    local ip_file="$2"
    
    # Extract IP addresses
    grep -oE '([0-9]{1,3}\.){3}[0-9]{1,3}' "$file" | sort | uniq > "$ip_file"
    
    # Also look for IPv6 addresses
    grep -oE '([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)' "$file" | sort | uniq >> "$ip_file"
}

# Function to extract usernames from a file
extract_users() {
    local file="$1"
    local user_file="$2"
    
    # Extract usernames from auth logs (customize patterns based on your log format)
    grep -oE 'user [a-zA-Z0-9_-]+|USER=[a-zA-Z0-9_-]+|username [a-zA-Z0-9_-]+' "$file" | sed 's/user //g' | sed 's/USER=//g' | sed 's/username //g' | sort | uniq > "$user_file"
}

# SSH authentication attempts
check_logs "SSH Authentication Attempts" "journalctl -u sshd --since='1 month ago'"

# Failed login attempts
check_logs "Failed Login Attempts" "journalctl --since='1 month ago' | grep -i 'failed password'"

# Successful logins
check_logs "Successful Logins" "journalctl --since='1 month ago' | grep -i 'accepted password\\|session opened'"

# Sudo usage
check_logs "Sudo Activity" "journalctl --since='1 month ago' | grep -i sudo"

# Firewall blocks
check_logs "UFW Firewall Blocks" "journalctl -u ufw --since='1 month ago'"
check_logs "FirewallD Blocks" "journalctl -u firewalld --since='1 month ago'"

# Docker security events
check_logs "Docker Events" "journalctl -u docker --since='1 month ago'"

# Audit logs
check_logs "Audit System Events" "journalctl -u auditd --since='1 month ago'"

# Kernel security messages
check_logs "Kernel Security Messages" "journalctl -k --since='1 month ago' | grep -i 'security\\|exploit\\|vulnerability\\|attack'"

# Service failures
check_logs "Service Failures" "journalctl --since='1 month ago' | grep -i 'failed\\|failure'"

# Permission denied errors
check_logs "Permission Denied Errors" "journalctl --since='1 month ago' | grep -i 'permission denied'"

# Network connection issues
check_logs "Network Connection Issues" "journalctl --since='1 month ago' | grep -i 'connection\\|accept\\|connect' | grep -v 'localhost'"

# User account changes
check_logs "User Account Changes" "journalctl --since='1 month ago' | grep -i 'user\\|password\\|account'"

# Suspicious commands
check_logs "Suspicious Commands" "journalctl _COMM=bash --since='1 month ago' | grep -i 'wget\\|curl\\|nc\\|netcat\\|base64\\|chmod\\|perl\\|python'"

# Crypto miner related
check_logs "Cryptominer Related" "journalctl --since='1 month ago' | grep -i 'perf\\|miner\\|crypto\\|coin\\|xmr'"

# Memory usage spikes
check_logs "Memory Usage Warnings" "journalctl --since='1 month ago' | grep -i 'memory\\|oom\\|killed'"

# Root activity
check_logs "Root User Activity" "journalctl --since='1 month ago' | grep -i 'root'"

# Extract IP addresses and usernames from key log files
echo -e "\n\033[1;34m==== Extracting IP Addresses and Usernames ====\033[0m"

# Create summary files for IPs and users
IP_SUMMARY="$OUTPUT_DIR/ip_addresses.txt"
USER_SUMMARY="$OUTPUT_DIR/usernames.txt"
IP_WHOIS="$OUTPUT_DIR/ip_whois_info.txt"

echo "Unique IP Addresses Found:" > "$IP_SUMMARY"
echo "------------------------" >> "$IP_SUMMARY"

echo "Unique Usernames Found:" > "$USER_SUMMARY"
echo "---------------------" >> "$USER_SUMMARY"

# Extract IPs and usernames from SSH and login logs
extract_ips "$OUTPUT_DIR/SSH_Authentication_Attempts.log" "$OUTPUT_DIR/temp_ips.txt"
extract_ips "$OUTPUT_DIR/Failed_Login_Attempts.log" "$OUTPUT_DIR/temp_ips.txt"
extract_ips "$OUTPUT_DIR/Successful_Logins.log" "$OUTPUT_DIR/temp_ips.txt"
extract_ips "$OUTPUT_DIR/Network_Connection_Issues.log" "$OUTPUT_DIR/temp_ips.txt"

# Sort and remove duplicates from all IP addresses
sort "$OUTPUT_DIR/temp_ips.txt" | uniq > "$OUTPUT_DIR/unique_ips.txt"
rm "$OUTPUT_DIR/temp_ips.txt"

# Extract usernames
extract_users "$OUTPUT_DIR/SSH_Authentication_Attempts.log" "$OUTPUT_DIR/temp_users.txt"
extract_users "$OUTPUT_DIR/Failed_Login_Attempts.log" "$OUTPUT_DIR/temp_users.txt"
extract_users "$OUTPUT_DIR/Successful_Logins.log" "$OUTPUT_DIR/temp_users.txt"
extract_users "$OUTPUT_DIR/Sudo_Activity.log" "$OUTPUT_DIR/temp_users.txt"

# Sort and remove duplicates from all usernames
sort "$OUTPUT_DIR/temp_users.txt" | uniq > "$OUTPUT_DIR/unique_users.txt"
rm "$OUTPUT_DIR/temp_users.txt"

# Look up IP information if whois is available
echo "IP Address WHOIS Information:" > "$IP_WHOIS"
echo "--------------------------" >> "$IP_WHOIS"

if command -v whois &> /dev/null; then
    echo -e "\033[0;36mLooking up WHOIS information for IP addresses...\033[0m"
    
    while IFS= read -r ip; do
        echo -e "\033[0;33mProcessing: $ip\033[0m"
        echo -e "\nIP: $ip" >> "$IP_WHOIS"
        echo "--------------------" >> "$IP_WHOIS"
        
        # Run whois and extract key information
        {
            echo "Organization:"
            whois "$ip" | grep -i "orgname\|organization\|netname" | head -3
            
            echo "Admin Email:"
            whois "$ip" | grep -i "admin-email\|abuse-mailbox\|e-mail\|email" | head -3
            
            echo "Country:"
            whois "$ip" | grep -i "country" | head -1
            
            echo "CIDR:"
            whois "$ip" | grep -i "cidr\|netblock\|inetnum" | head -1
        } >> "$IP_WHOIS"
        
        # Add a summary line to the main IP summary
        org=$(whois "$ip" | grep -i "orgname\|organization\|netname" | head -1 | cut -d':' -f2- | xargs)
        country=$(whois "$ip" | grep -i "country" | head -1 | cut -d':' -f2- | xargs)
        email=$(whois "$ip" | grep -i "admin-email\|abuse-mailbox\|e-mail\|email" | head -1 | cut -d':' -f2- | xargs)
        
        echo "$ip - Org: $org, Country: $country, Contact: $email" >> "$IP_SUMMARY"
        
        # Rate limiting to avoid being blocked by WHOIS servers
        sleep 1
    done < "$OUTPUT_DIR/unique_ips.txt"
else
    echo "WHOIS command not found. Unable to look up IP information." >> "$IP_WHOIS"
    cat "$OUTPUT_DIR/unique_ips.txt" >> "$IP_SUMMARY"
fi

# Add usernames to summary
cat "$OUTPUT_DIR/unique_users.txt" >> "$USER_SUMMARY"

# Display IP and username counts
ip_count=$(wc -l < "$OUTPUT_DIR/unique_ips.txt")
user_count=$(wc -l < "$OUTPUT_DIR/unique_users.txt")

echo -e "\033[1;33mFound $ip_count unique IP addresses\033[0m"
echo -e "\033[1;33mFound $user_count unique usernames\033[0m"

# Show sample of IPs and usernames
echo -e "\033[0;36mSample IP addresses (max 5):\033[0m"
head -n 5 "$OUTPUT_DIR/unique_ips.txt"
if [ "$ip_count" -gt 5 ]; then
    echo -e "\033[0;36m... (see $IP_SUMMARY for complete results with WHOIS info)\033[0m"
fi

echo -e "\033[0;36mSample usernames (max 5):\033[0m"
head -n 5 "$OUTPUT_DIR/unique_users.txt"
if [ "$user_count" -gt 5 ]; then
    echo -e "\033[0;36m... (see $USER_SUMMARY for complete results)\033[0m"
fi

# Create a summary file
SUMMARY="$OUTPUT_DIR/00_summary.txt"
echo "Security Scan Summary - $(date)" > "$SUMMARY"
echo "=================================" >> "$SUMMARY"
echo "" >> "$SUMMARY"

echo "Log counts by category:" >> "$SUMMARY"
for file in "$OUTPUT_DIR"/*.log; do
    count=$(grep -v "^====" "$file" | wc -l)
    name=$(basename "$file" .log | tr '_' ' ')
    echo "- $name: $count entries" >> "$SUMMARY"
done

echo "" >> "$SUMMARY"
echo "IP and User Summary:" >> "$SUMMARY"
echo "- Found $ip_count unique IP addresses" >> "$SUMMARY"
echo "- Found $user_count unique usernames" >> "$SUMMARY"
echo "" >> "$SUMMARY"

echo "Potential security concerns:" >> "$SUMMARY"

# Add high-priority findings to summary
failed_logins=$(grep -v "^====" "$OUTPUT_DIR/Failed_Login_Attempts.log" | wc -l)
if [ "$failed_logins" -gt 10 ]; then
    echo "! HIGH: $failed_logins failed login attempts detected" >> "$SUMMARY"
fi

crypto_findings=$(grep -v "^====" "$OUTPUT_DIR/Cryptominer_Related.log" | wc -l)
if [ "$crypto_findings" -gt 0 ]; then
    echo "! HIGH: $crypto_findings potential cryptominer references found" >> "$SUMMARY"
fi

permission_errors=$(grep -v "^====" "$OUTPUT_DIR/Permission_Denied_Errors.log" | wc -l)
if [ "$permission_errors" -gt 20 ]; then
    echo "! MEDIUM: $permission_errors permission denied errors" >> "$SUMMARY"
fi

suspicious_cmds=$(grep -v "^====" "$OUTPUT_DIR/Suspicious_Commands.log" | wc -l)
if [ "$suspicious_cmds" -gt 0 ]; then
    echo "! MEDIUM: $suspicious_cmds potentially suspicious commands executed" >> "$SUMMARY"
fi

echo "" >> "$SUMMARY"
echo "Security scan completed at $(date)" >> "$SUMMARY"
echo "For detailed results, check the individual log files in $OUTPUT_DIR/" >> "$SUMMARY"

# Display summary to console
echo -e "\n\033[1;32m========== SECURITY SCAN SUMMARY ==========\033[0m"
cat "$SUMMARY"

# Display completion message
echo -e "\n\033[1;32mSecurity scan complete! Results saved to $OUTPUT_DIR/\033[0m"
echo -e "\033[1;32mCheck $SUMMARY for a summary of findings.\033[0m"
echo -e "\033[1;32mIP WHOIS information is in $IP_WHOIS\033[0m"
