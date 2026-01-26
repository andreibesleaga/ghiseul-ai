FROM python:3.11-slim

ENV LANG=C.UTF-8

RUN apt-get update -y && apt-get install -y --no-install-recommends --fix-missing \
    build-essential \
    wget curl \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user (same as dataprep)
RUN useradd -m -s /bin/bash user && \
    mkdir -p /home/user && \
    chown -R user /home/user/

# Copy into /home/user/comps for consistency
COPY comps /home/user/comps

# Install Python deps
RUN pip install --no-cache-dir --upgrade pip setuptools && \
    pip install --no-cache-dir -r /home/user/comps/third_parties/httpservices/requirements.txt

# Switch to non-root user
USER user

# Workdir inside comps (consistent pattern)
WORKDIR /home/user/comps/third_parties/httpservices

EXPOSE 6666

# Run the FastAPI service
ENTRYPOINT ["uvicorn", "test:app", "--host", "0.0.0.0", "--port", "6666"]
