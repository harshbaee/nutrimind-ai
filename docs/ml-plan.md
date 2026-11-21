# Own models: plan and decisions

NutriMind's AI features (meal photo recognition, the coach's answers, matching food names to foods) will run on models we train ourselves, end to end, as a portfolio showcase. No paid or hosted AI API. This file is the hand-off for whoever does the training; it records what was decided on 2026-11-21 and why.

## Decisions

| Question | Decision |
|---|---|
| Where training runs | The second laptop: NVIDIA **GTX 1650** (usually 4 GB VRAM, Turing, no tensor cores, so AMP/fp16 helps memory more than speed). Claude Code runs on that laptop and drives the training. |
| Where the app runs | The first laptop: Intel i5-1335U, 16 GB RAM, **no usable GPU**. Trained models are exported for CPU inference (ONNX Runtime for vision and the retriever, GGUF via llama.cpp for the language model). |
| Photo model | Fine-tune end to end on the full **Food-101** (101,000 images, 101 dishes), not a small sample. |
| Coach | A real **RAG pipeline**: our own fine-tuned retriever + a small open LLM **LoRA fine-tuned by us** to answer from retrieved context. |
| OmniRoute / hosted AI | **Remove** once our models replace it (see "Removing OmniRoute"). Until then it stays, so nothing breaks in between. |
| Honesty | Every reported number comes from a held-out split the model never trained on, next to a baseline. Synthetic data is labelled as synthetic. Pretrained starting weights are stated ("fine-tuned from ImageNet weights"), not hidden. |

## Setup on the GPU laptop

1. Install the NVIDIA driver, Python 3.12, Git, and Claude Code.
2. `git clone https://github.com/harshbaee/nutrimind-ai.git` and open it with Claude Code. `CLAUDE.md` there carries the project rules.
3. Create `.venv`, install PyTorch with CUDA from download.pytorch.org (pick the CUDA build the installed driver supports), then `ml/requirements.txt`.
4. First script to write and run: `ml/check_gpu.py`, which prints the GPU name, VRAM and a tiny forward/backward pass, so a long run never starts on the CPU by mistake.
5. Keep datasets and Hugging Face caches on a drive with room (set `HF_HOME`), not on a nearly full C:.

## Layout

```
ml/
  requirements.txt      training deps (torch installed separately for CUDA)
  check_gpu.py
  food101/              photo classifier: data, train, evaluate, export
  retriever/            embedding model fine-tune + retrieval eval
  coach_llm/            QA dataset build, LoRA fine-tune, eval, GGUF export
  rag/                  index build + query pipeline used by the backend
  models/               trained artifacts (git-ignored; shipped as GitHub Release assets)
  reports/              metrics, confusion matrices, model cards (committed)
```

## Model 1: food photo classifier

- **Data:** Food-101 (official split: 75,750 train / 25,250 test; about 5 GB). `torchvision.datasets.Food101` downloads it. Hold out part of train for validation; the test split is only for the final number.
- **Model:** EfficientNet-B0 (fallback MobileNetV3-Large if memory is tight) from ImageNet weights, 224 px, AMP, batch size as large as 4 GB allows (start 32), AdamW, cosine schedule with warm-up, label smoothing 0.1, TrivialAugment + random resized crop, roughly 15 to 25 epochs. Checkpoint every epoch so a crash or a closed lid loses little.
- **Target:** at least 85% top-1 on the test split (published EfficientNet-B0 fine-tunes land around 85 to 90%). Report top-1, top-5, per-class accuracy, the most confused pairs, and the baseline (a linear probe on frozen features) for comparison.
- **Export:** ONNX + `labels.json`; check ONNX and PyTorch outputs agree on a sample. Measure CPU latency per photo on the app laptop.
- **Portion size:** Food-101 has no weights, and Nutrition5k (which does) is about 180 GB, too big for these disks. Each of the 101 dishes gets a typical portion in grams from USDA serving data; the user adjusts it in the meal panel.
- **Integration:** replace `recognise_meal()` in `backend/services/photo.py`. Keep the response shape `{"foods": [{"name", "grams", "product_id", "product_name"}]}` so `LogMeal.tsx` keeps working; it already lets the user check amounts and lists foods not in the pantry.

## Model 2: retriever (embeddings)

- **Data:** USDA **FoodData Central** (Foundation, SR Legacy, Survey/FNDDS, and a sample of Branded foods; public domain).
- **Pairs to train on:** (food description, its other names and spellings), (branded product name, matching generic food), (query templates such as "high protein snack", nutrient-based questions, and the matching foods). Split by food, so no food is in both train and test.
- **Model:** fine-tune a small sentence-embedding model (e.g. `bge-small-en-v1.5` or `all-MiniLM-L6-v2`) with in-batch negatives (MultipleNegativesRankingLoss).
- **Metrics:** recall@1/5/10 and MRR on held-out queries, against BM25 and against the untuned base model.
- **Uses:** (a) match the photo model's dish names and typed names to foods and to the user's pantry, replacing `difflib` in `photo.py`; (b) the retrieval half of RAG.
- **Export:** ONNX for CPU inference in the backend.

## Model 3: coach answer model (LoRA)

- **Base:** Qwen2.5-0.5B-Instruct (try 1.5B with 4-bit QLoRA only if it fits in 4 GB and the 0.5B results are weak).
- **Data:** grounded Q&A, each example = question + retrieved context (food facts from FoodData Central, and anonymised user-log summaries shaped like `coach_facts()` in `backend/services/coach.py`) + the answer. Built from templates over real FDC numbers, so the facts are correct; labelled synthetic. Include questions whose answer isn't in the context, with the answer "I don't know from your data", so the model learns not to invent numbers.
- **Metrics on a held-out set:** numeric accuracy (numbers in the answer match the context), faithfulness (no number that isn't in the context), refusal accuracy on unanswerable questions, against the untuned base model with the same prompts.
- **Export:** merge LoRA weights, convert to GGUF (4-bit) for llama.cpp; measure tokens per second on the app laptop's CPU.

## RAG pipeline (backend)

1. Index: FoodData Central foods + short nutrition-guideline passages + the user's own figures (today's meals, goals, pantry) embedded with Model 2, kept in a FAISS or plain NumPy index.
2. Query: embed the question, take the top-k passages, prompt Model 3 with them, and return the answer with its sources (the existing `CoachAnswerResponse.sources` field).
3. Fallback: if the models aren't present, the coach keeps its current rule-based text, so the app always works.
4. Evaluate end to end on a held-out question set (answer correctness + faithfulness), and keep that script in `ml/rag/`.

## Removing OmniRoute

When Models 1 to 3 are integrated: delete `ai_chat()`, `ask_ai()` and `coach_model()` (`backend/services/coach.py`), `vision_model()` (`backend/services/photo.py`), the `COACH_*` and `VISION_MODEL` settings in `README.md` and `docker/docker-compose.yml`, and the tests that fake OmniRoute replies in `backend/tests/test_api.py`, replacing them with tests against the local models (or small stand-ins). `requests` stays: Open Food Facts and Open Prices use it.

## Showcase

Each model gets a short model card in `ml/reports/`: data, recipe, training time on the GTX 1650, held-out metrics next to the baseline, known limits. The README links them.
