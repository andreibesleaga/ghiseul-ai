#!/bin/bash
# Copyright (C) 2025 Intel Corporation
# SPDX-License-Identifier: Apache-2.0

chatqna_arg=$CHATQNA_TYPE

if [[ $chatqna_arg == "CHATQNA_FAQGEN" ]]; then
    python chatqna.py --faqgen
elif [[ $chatqna_arg == "CHATQNA_NO_RERANK" ]]; then
    python chatqna.py --without-rerank
elif [[ $chatqna_arg == "CHATQNA_GUARDRAILS" ]]; then
    python chatqna.py --with-guardrails
elif [[ $chatqna_arg == "CHATQNA_GENIE_AI" ]]; then
    python chatqna.py --genie-ai
elif [[ $chatqna_arg == "CHATQNA_DAVID" ]]; then
    python chatqna_genieai.py --with-translation
elif [[ $chatqna_arg == "CHATQNA_MACDAVID" ]]; then
    python chatqna_genieai.py --without-translation
else
    python chatqna_genieai.py
fi
