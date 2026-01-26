# Copyright (C) 2024 Intel Corporation
# SPDX-License-Identifier: Apache-2.0

ARG IMAGE_REPO=opea
ARG BASE_TAG=latest
FROM $IMAGE_REPO/comps-base:$BASE_TAG

COPY ./chatqna.py $HOME/chatqna.py
COPY ./entrypoint.sh $HOME/entrypoint.sh

ENV PYTHONPATH="/root/opea_arangodb/1.3/GenAIComps:${PYTHONPATH}"

ENTRYPOINT ["bash", "entrypoint.sh"]
