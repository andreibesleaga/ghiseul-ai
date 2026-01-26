#!/bin/bash
set -e

echo "======================================================="
echo "GENIE.AI Docker & NVIDIA Repair Script"
echo "======================================================="
echo "This script will:"
echo "1. Remove the Snap version of Docker (incompatible with NVIDIA Toolkit)"
echo "2. Install the official Docker Engine"
echo "3. Install the NVIDIA Container Toolkit"
echo "4. Configure Docker to use the NVIDIA runtime"
echo ""
echo "NOTE: Any existing Docker containers/volumes in the Snap version will be removed."
echo "Press Ctrl+C to cancel within 5 seconds..."
sleep 5

# 1. Remove Docker Snap
if snap list docker &>/dev/null; then
    echo "Removing Docker Snap..."
    sudo snap remove docker
fi

# 2. Add Docker's official GPG key and repo
echo "Setting up Docker official repository..."
sudo apt-get update
sudo apt-get install -y ca-certificates curl gnupg
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc

echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# 3. Install Docker Engine
echo "Installing Docker Engine..."
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# 4. Install Docker Compose Standalone (for script compatibility)
echo "Installing Docker Compose standalone..."
sudo curl -SL https://github.com/docker/compose/releases/download/v2.24.1/docker-compose-linux-x86_64 -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# 5. Add user to docker group
echo "Configuring permissions..."
sudo usermod -aG docker $USER

# 6. Add NVIDIA Container Toolkit repo
echo "Setting up NVIDIA Container Toolkit..."
curl -fsSL https://nvidia.github.io/libnvidia-container/gpgkey | sudo gpg --dearmor -o /usr/share/keyrings/nvidia-container-toolkit-keyring.gpg
curl -s -L https://nvidia.github.io/libnvidia-container/stable/deb/nvidia-container-toolkit.list | \
  sed 's#deb https://#deb [signed-by=/usr/share/keyrings/nvidia-container-toolkit-keyring.gpg] https://#' | \
  sudo tee /etc/apt/sources.list.d/nvidia-container-toolkit.list

# 7. Install Toolkit
sudo apt-get update
sudo apt-get install -y nvidia-container-toolkit

# 8. Configure Docker
echo "Configuring Docker runtime..."
sudo nvidia-ctk runtime configure --runtime=docker
sudo systemctl restart docker

echo "======================================================="
echo "Done! "
echo "Please close this terminal and open a new one to apply the group changes."
echo "Then your start-6gb-gpu.sh script should work."
echo "======================================================="
