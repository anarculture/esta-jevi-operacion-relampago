# Modelo de visión open weights para leer comprobantes

Investigación del 24-oct-2026 (sábado de noche). La venta de prueba es el domingo 25-oct y la fiesta el
jueves 29-oct. Los catálogos y precios se tomaron ese mismo día de los endpoints públicos `/models` de
OpenRouter, DeepInfra y Novita, de las model cards de Hugging Face (API `huggingface.co/api/models`) y de
los leaderboards oficiales. **No probé ninguna llamada real con imagen**: no tenía claves de API.

## Recomendación

**Usa `qwen/qwen3.6-27b` por OpenRouter (`https://openrouter.ai/api/v1`). Si falla, usa
`nvidia/nemotron-3.5-super-vl` en el mismo proveedor.** El cambio en `revisar/index.ts` se reduce a URL,
clave y model id, más dos campos en el body: apagar el razonamiento y restringir el ruteo a proveedores que
cumplen `json_schema`.

Por qué este par:
- **Qwen3.6-27B** (Apache-2.0, 27,8B de parámetros, sale el 21-abr-2026) es el modelo open weights con
  mejor promedio en el leaderboard **independiente** OCRBench v2 (ronda 2026.09, tareas en inglés): 68,3
  de promedio y 92,8 en *Extraction*, que es la subtarea de extraer campos clave
  ([leaderboard](https://99franklin.github.io/ocrbench_v2/)). Su model card reporta 89,4 en OCRBench y 81,2
  en CC-OCR ([card](https://huggingface.co/Qwen/Qwen3.6-27B)).
- **Nemotron 3.5 Super VL** (120B MoE, 12B activos, licencia OpenMDW-1.1) va justo detrás en el mismo
  leaderboard independiente (67,4 de promedio, 74,0 en *Recognition*, 92,2 en *Extraction*). Es de otra
  familia, así que no comparte los errores de Qwen, y cuesta $0,15/$0,50 por millón
  ([card](https://huggingface.co/nvidia/NVIDIA-Nemotron-3.5-Super-VL-120B-A12B-BF16),
  [Together](https://docs.together.ai/docs/serverless/models)).
- **OpenRouter**: una sola clave para los dos modelos, `json_schema` con `strict`, imagen en base64,
  respaldo automático entre proveedores y un filtro para no caer en cuantizaciones de 4 bits
  ([structured outputs](https://openrouter.ai/docs/guides/features/structured-outputs),
  [provider routing](https://openrouter.ai/docs/guides/routing/provider-selection)).
- **Candidato A/B**: `qwen/qwen3.8-27b` (5-ago-2026) gana en *Recognition* (75,5, el mejor open) y en el
  OmniDocBench 1.5 que reporta su autor (91,1), pero pierde en promedio (63,5) y en *Extraction* (90,4) en
  el leaderboard independiente. La diferencia es pequeña en ambos sentidos. Pruébalo con las mismas
  capturas el domingo: es cambiar una cadena.

**Costo estimado**: cerca de $0,002 por orden y menos de $0,50 por las 200 órdenes (ver la sección de
proveedores). No pesa en la decisión.

## Candidatos (verificados en Hugging Face el 24-oct)

Leyenda: **OR** = servido en OpenRouter con imagen y `structured_outputs`; **n/v** = no verificado.

| Modelo (repo HF) | Fecha | Licencia | Tamaño | ¿En OR con visión + schema? | Nota |
|---|---|---|---|---|---|
| [Qwen/Qwen3.6-27B](https://huggingface.co/Qwen/Qwen3.6-27B) | 21-abr-2026 | Apache-2.0 | 27,8B denso | sí, `qwen/qwen3.6-27b` | Razona por defecto. Hay versión FP8 oficial ([Qwen3.6-27B-FP8](https://huggingface.co/Qwen/Qwen3.6-27B-FP8)). |
| [Qwen/Qwen3.8-27B](https://huggingface.co/Qwen/Qwen3.8-27B) | 5-ago-2026 | Apache-2.0 | 27,8B denso | sí, `qwen/qwen3.8-27b` (21 endpoints) | Razona por defecto con esfuerzo `xhigh` en OR. Versión FP8 oficial ([Qwen3.8-27B-FP8](https://huggingface.co/Qwen/Qwen3.8-27B-FP8)). |
| [Qwen/Qwen3.6-35B-A3B](https://huggingface.co/Qwen/Qwen3.6-35B-A3B) | 15-abr-2026 | Apache-2.0 | 35B MoE, 3B activos | sí, `qwen/qwen3.6-35b-a3b` | Más barato y rápido; OCRBench v2 EN 65,5 (independiente). |
| [Qwen/Qwen3.8-Flash-Next](https://huggingface.co/Qwen/Qwen3.8-Flash-Next) | 24-ago-2026 | `qwen-community-1.0` (no Apache) | n/v | no como tal: `qwen/qwen3.8-flash` es la versión cerrada de Alibaba | La card lo llama "experimental preview". |
| [nvidia/NVIDIA-Nemotron-3.5-Super-VL-120B-A12B-BF16](https://huggingface.co/nvidia/NVIDIA-Nemotron-3.5-Super-VL-120B-A12B-BF16) | 12-oct-2026 | OpenMDW-1.1 | 120B MoE, 12B activos | sí, `nvidia/nemotron-3.5-super-vl` | El español está entre sus idiomas declarados. NVIDIA publica también una versión NVFP4 oficial. |
| [google/gemma-4-31B-it](https://huggingface.co/google/gemma-4-31B-it) | abr-2026 | Apache-2.0 | 30,7B denso | sí, `google/gemma-4-31b-it` (16 endpoints) | No razona por defecto. OCR más débil que Qwen (ver benchmarks). |
| [mistralai/Mistral-Small-4-119B-2603](https://huggingface.co/mistralai/Mistral-Small-4-119B-2603) | 2026 | Apache-2.0 | 119B | sí, `mistralai/mistral-small-2603` (solo lo sirve Mistral) | Sin benchmarks de OCR verificados. Pixtral quedó superado. |
| [deepseek-ai/DeepSeek-V4-Flash-Vision-Exp](https://huggingface.co/deepseek-ai/DeepSeek-V4-Flash-Vision-Exp) | 31-ago-2026 | MIT | n/v | sí (DeepInfra) | Experimental; sin cifras de OCR en su card. |
| [meta-llama/Llama-4-Maverick-17B-128E-Instruct](https://huggingface.co/meta-llama/Llama-4-Maverick-17B-128E-Instruct) | abr-2025 | Llama 4 (`other`) | 400B MoE | sí | No hay Llama más nuevo con visión en HF. Queda atrás. |
| [zai-org/GLM-4.6V](https://huggingface.co/zai-org/GLM-4.6V) | dic-2025 | MIT | 108B | **no**: OR no marca `structured_outputs` en ningún endpoint | Descartado por el JSON. |
| [openbmb/MiniCPM-V-4.7-35B-A3B](https://huggingface.co/openbmb/MiniCPM-V-4.7-35B-A3B) | 7-oct-2026 | Apache-2.0 | 35B MoE | no aparece en OR | Solo self-host. |
| [OpenGVLab InternVL3.5](https://huggingface.co/OpenGVLab/InternVL3_5-8B) | ago-2025 | n/v | 1B a 241B | no aparece en OR | No encontré InternVL4. |

**OCR especializados** (salen en markdown o texto plano, no en tu esquema): [PaddleOCR-VL-1.6](https://huggingface.co/PaddlePaddle/PaddleOCR-VL-1.6) (0,96B, Apache-2.0),
[GLM-OCR](https://huggingface.co/zai-org/GLM-OCR) (1,3B, MIT), [DeepSeek-OCR-2](https://huggingface.co/deepseek-ai/DeepSeek-OCR-2),
[dots.mocr](https://huggingface.co/dots-studio/dots.mocr) (3B, MIT; sucesor de dots.ocr, ahora bajo `dots-studio`),
[olmOCR-2-7B-1025](https://huggingface.co/allenai/olmOCR-2-7B-1025), [MinerU2.5-Pro](https://huggingface.co/opendatalab/MinerU2.5-Pro-2605-1.2B)
y [Nemotron-3.5-Parse](https://huggingface.co/nvidia/Nemotron-3.5-Parse). Lideran OmniDocBench, pero ese
benchmark mide páginas de PDF (tablas, fórmulas, orden de lectura), no capturas de una app bancaria. Usarlos
obliga a montar dos pasos (OCR y después un LLM que arme el JSON). **No es para el domingo.** DeepInfra
sirve PaddleOCR-VL-0.9B, olmOCR-2 y DeepSeek-OCR ([catálogo](https://api.deepinfra.com/models/list)), y
Novita sirve `deepseek/deepseek-ocr-2` y `paddlepaddle/paddleocr-vl` ([catálogo](https://api.novita.ai/v3/openai/models)).

## Benchmarks de OCR y documentos

### Independientes

**OCRBench v2, ronda 2026.09, tareas en inglés** ([leaderboard oficial](https://99franklin.github.io/ocrbench_v2/),
repo [Yuliang-Liu/MultimodalOCR](https://github.com/Yuliang-Liu/MultimodalOCR)). *Recognition* = leer
texto; *Extraction* = extraer campos clave de documentos, lo más parecido a este caso.

| Modelo (open) | Promedio | Recognition | Extraction | Calculation |
|---|---|---|---|---|
| Qwen3.6-27B | **68,3** | 71,1 | **92,8** | 81,9 |
| Nemotron 3.5 Super VL | 67,4 | 74,0 | 92,2 | 87,9 |
| Qwen3.6-35B-A3B (ronda 2026.03) | 65,5 | 74,9 | 91,5 | 78,0 |
| Qwen3.8-27B | 63,5 | **75,5** | 90,4 | 67,9 |
| Gemma 4 12B (ronda 2026.03) | 51,8 | 51,5 | 81,8 | 64,8 |
| *Gemini 3 Pro Preview (cerrado, referencia)* | 63,4 | 68,5 | 93,9 | 49,7 |

Gemma 4 31B no aparece en este leaderboard. Los primeros puestos generales son sistemas cerrados (SEEU DOC,
76,2).

**OmniDocBench v1.6** ([README oficial](https://github.com/opendatalab/OmniDocBench), parsing de
documentos, *Overall* ↑): PaddleOCR-VL-1.6 96,34; GLM-OCR 95,22; Gemini 3 Pro 92,91; Gemini 3 Flash 92,62;
dots.ocr 90,77; DeepSeek-OCR 2 90,25; Qwen3-VL-235B 89,78; GPT-5.2 86,59; olmOCR 85,74. **Ni Qwen3.6, ni
Qwen3.8, ni Gemma 4 ni Nemotron 3.5 están evaluados ahí.** Tampoco se pueden comparar con las cifras
"OmniDocBench 1.5" de sus autores, porque la versión cambió el 10-abr-2026.

### Reportados por el autor (no independientes)

| Modelo | Cifra | Fuente |
|---|---|---|
| Qwen3.6-27B | OCRBench 89,4; CC-OCR 81,2; CharXiv RQ 78,4 | [card](https://huggingface.co/Qwen/Qwen3.6-27B) |
| Qwen3.6-35B-A3B | OCRBench 90,0; CC-OCR 81,9; OmniDocBench 1.5 89,9 | [card 27B](https://huggingface.co/Qwen/Qwen3.6-27B), [card 35B](https://huggingface.co/Qwen/Qwen3.6-35B-A3B) |
| Qwen3.8-27B | OmniDocBench 1.5 91,1 (contra 89,4 de Qwen3.6-27B); CharXiv RQ 83,7 | [card](https://huggingface.co/Qwen/Qwen3.8-27B) |
| Gemma 4 31B | OmniDocBench 1.5 edit distance 0,131 (menor es mejor; Gemma 3 27B: 0,365) | [card](https://huggingface.co/google/gemma-4-31B-it) |
| Gemma 4 31B, **medido por Qwen** | OCRBench 86,1; CC-OCR 75,7; OmniDocBench 1.5 80,1 | tablas de las cards de [Qwen3.6-27B](https://huggingface.co/Qwen/Qwen3.6-27B) y [Qwen3.6-35B-A3B](https://huggingface.co/Qwen/Qwen3.6-35B-A3B) (las mide un competidor) |
| Nemotron 3.5 Super VL | OCRBench v2 EN 68,12; ZH 59,15; OCR-Reasoning 65,08 | [card](https://huggingface.co/nvidia/NVIDIA-Nemotron-3.5-Super-VL-120B-A12B-BF16) |

Ningún benchmark mide comprobantes en español ni montos con formato venezolano (`1.185,82`). La única
prueba que vale es correr 10 capturas reales.

## Proveedores con API compatible con OpenAI

Precios en USD por millón de tokens (entrada / salida), tomados el 24-oct. **so** = el proveedor declara
`structured_outputs`; **b64** = la doc dice que acepta imagen en data URL base64.

| Proveedor | Base URL | Modelo (id exacto) | Precio | so | b64 | Fuente |
|---|---|---|---|---|---|---|
| OpenRouter | `https://openrouter.ai/api/v1` | `qwen/qwen3.6-27b` | lista $0,25 / $2,00; por endpoint de $0,20/$2,00 (Reka) a $0,45/$2,70 (Alibaba); DeepInfra fp8 $0,32/$3,20 | sí en 6 de 7 endpoints (Chutes no acepta `response_format`) | sí: png, jpeg, webp, gif | [/models](https://openrouter.ai/api/v1/models), [endpoints](https://openrouter.ai/api/v1/models/qwen/qwen3.6-27b/endpoints), [imágenes](https://openrouter.ai/docs/guides/overview/multimodal/image-understanding) |
| OpenRouter | ídem | `qwen/qwen3.8-27b` | lista $0,20 / $2,50; de $0,02/$0,50 (Tenstorrent fp4, sin so) a $0,99/$1,49 (Cerebras, sin so) | sí en 17 de 21 (no: Tenstorrent, Novita, Alibaba, Cerebras) | sí | [endpoints](https://openrouter.ai/api/v1/models/qwen/qwen3.8-27b/endpoints) |
| OpenRouter | ídem | `nvidia/nemotron-3.5-super-vl` | lista $0,15 / $0,50; Crusoe bf16 $0,10/$0,40 | sí en 6 de 8 | sí | [endpoints](https://openrouter.ai/api/v1/models/nvidia/nemotron-3.5-super-vl/endpoints) |
| OpenRouter | ídem | `google/gemma-4-31b-it` | lista $0,20 / $0,40; de $0,10/$0,34 a $0,75/$1,00 | sí en 14 de 16 | sí | [endpoints](https://openrouter.ai/api/v1/models/google/gemma-4-31b-it/endpoints) |
| DeepInfra | `https://api.deepinfra.com/v1/openai` | `Qwen/Qwen3.6-27B` | $0,32 / $3,20 | sí (`structured-output`, `multimodal`) | sí; jpg, png, webp, máx. 20 MB | [catálogo](https://api.deepinfra.com/models/list), [visión](https://deepinfra.com/docs/advanced/multimodal), [JSON](https://deepinfra.com/docs/advanced/json_mode) |
| DeepInfra | ídem | `Qwen/Qwen3.8-27B` | $0,20 / $2,50 con descuento de 25 % (OR lo muestra a $0,15/$1,875, bf16) | sí, más `can-disable-reasoning` | sí | ídem |
| DeepInfra | ídem | `nvidia/NVIDIA-Nemotron-3.5-Super-VL` | $0,15 / $0,50 | sí | sí | ídem |
| DeepInfra | ídem | `google/gemma-4-31B-it` | $0,20 / $0,40 | sí | sí | ídem |
| Together | `https://api.together.xyz/v1` (n/v: la doc usa `api.together.ai`) | `nvidia/NVIDIA-Nemotron-3.5-Super-VL` | $0,15 / $0,50, cuantización NVFP4 | sí | n/v (la doc solo muestra URL) | [catálogo](https://docs.together.ai/docs/serverless/models), [visión](https://docs.together.ai/docs/vision-overview), [JSON](https://docs.together.ai/docs/json-mode) |
| Novita | `https://api.novita.ai/v3/openai` (n/v) | `qwen/qwen3.6-27b`, `qwen/qwen3.8-27b`, `google/gemma-4-31b-it` | $0,60/$3,60; $0,42/$3,00; $0,14/$0,40 | declara `structured-outputs`, pero OR marca so=no en sus endpoints de Qwen3.8 | n/v | [/models](https://api.novita.ai/v3/openai/models) |
| Google (Gemini API) | `https://generativelanguage.googleapis.com/v1beta/openai` | `gemma-4-31b-it` | **solo free tier**; el tier pago dice "Not available" | n/v para Gemma | sí (doc de compatibilidad OpenAI) | [Gemma en Gemini API](https://ai.google.dev/gemma/docs/core/gemma_on_gemini_api), [precios](https://ai.google.dev/gemini-api/docs/pricing) |
| Groq | n/v | n/v | n/v | n/v | n/v | `console.groq.com/docs` respondió 403 y `/models` exige clave |
| Fireworks | n/v | n/v | n/v | n/v | n/v | `/models` exige clave |

Gemma por la Gemini API usaría la misma `GEMINI_API_KEY`, pero no conviene: la tabla de precios dice que en
el free tier los datos se usan "to improve our products" ([precios](https://ai.google.dev/gemini-api/docs/pricing)),
y los comprobantes llevan nombres, teléfonos y cédulas.

**Estimación de costo con Qwen3.6-27B en DeepInfra ($0,32/$3,20):** unos 3.000 tokens de entrada (prompt
más una captura de teléfono) y 200 de salida dan unos $0,0016 por orden, es decir, unos $0,32 por 200
órdenes. **Los 3.000 tokens de imagen son una estimación (sin verificar):** depende de la resolución y del
tokenizador de visión de cada modelo.

## Qué cambiar en `supabase/functions/revisar/index.ts`

1. **URL**: `https://generativelanguage.googleapis.com/v1beta/openai/chat/completions` →
   `https://openrouter.ai/api/v1/chat/completions`.
2. **Clave**: `GEMINI_API_KEY` → `OPENROUTER_API_KEY` (`supabase secrets set OPENROUTER_API_KEY=...`).
3. **Modelo**: el default de `OCR_MODEL` pasa a `qwen/qwen3.6-27b`. El respaldo es
   `OCR_MODEL=nvidia/nemotron-3.5-super-vl`, sin redeploy.
4. **Apagar el razonamiento.** Este es el punto que más se rompe. Qwen3.6 y Qwen3.8 razonan por defecto
   (OR: `default_enabled: true`; Qwen3.8 con `default_effort: "xhigh"`), y los tokens de razonamiento
   **cuentan contra `max_tokens`** ([doc](https://openrouter.ai/docs/guides/best-practices/reasoning-tokens)).
   Con el `max_tokens: 600` actual, la respuesta puede quedar cortada o vacía. Agrega
   `reasoning: { enabled: false }` y sube `max_tokens` a unos 2000 como colchón.
5. **Ruteo**: agrega `provider` para que solo responda un proveedor que cumpla el esquema y no use 4 bits
   genéricos. Para Nemotron se permite `nvfp4` porque es la cuantización oficial de NVIDIA:

```ts
body: JSON.stringify({
  model: MODEL,
  temperature: 0,
  max_tokens: 2000,
  reasoning: { enabled: false },
  provider: { require_parameters: true, quantizations: ["bf16", "fp16", "fp8", "nvfp4"], data_collection: "deny" },
  response_format: { type: "json_schema", json_schema: { name: "receipt", strict: true, schema: SCHEMA } },
  messages: [/* igual que ahora */],
}),
```

6. El mensaje de error dice `gemini ${r.status}`. Es cosmético, cámbialo a `ocr`.

Compatibilidad del esquema actual: es un objeto plano de strings con `enum`, `required` completo y
`additionalProperties: false`, que es el subconjunto que aceptan los modos strict. OpenRouter avisa que
`strict` se cumple de forma estricta solo donde el proveedor tiene modo nativo; en otros "treat it as a strong
hint" ([doc](https://openrouter.ai/docs/guides/features/structured-outputs)). El `JSON.parse` con el
`replace` de los fences ya cubre ese caso, y el `catch` deja la orden en "dudoso". Si quieres más margen,
existe el plugin [Response Healing](https://openrouter.ai/docs/guides/features/plugins/response-healing),
que repara JSON mal formado en llamadas sin streaming.

**Alternativa sin intermediario**: DeepInfra directo con `https://api.deepinfra.com/v1/openai/chat/completions`,
`DEEPINFRA_API_KEY` y `Qwen/Qwen3.6-27B`. Su doc muestra `json_schema` con `strict: True` y base64. Para
apagar el razonamiento, la card de Qwen usa `chat_template_kwargs: {enable_thinking: false}`
([card](https://huggingface.co/Qwen/Qwen3.8-27B)); que DeepInfra lo acepte así no está verificado (solo
etiqueta el modelo como `can-disable-reasoning`).

## Self-host (secundario por el plazo)

- **VRAM**: Qwen3.6-27B y Qwen3.8-27B tienen 27,8B de parámetros en BF16 (API de HF), unos 56 GB solo de
  pesos. Necesitas una GPU de 80 GB (A100 o H100), o la versión FP8 oficial (unos 28 GB de pesos) en una de
  48 GB (L40S o A6000), contando la KV cache. Nemotron 3.5 Super VL tiene 124B en BF16 y queda fuera de una
  sola GPU salvo en NVFP4.
- **vLLM**: soporta `response_format` con `json_schema` usando los backends xgrammar o guidance
  ([doc](https://docs.vllm.ai/en/latest/features/structured_outputs.html)). La card de Nemotron pide
  `vllm/vllm-openai:v0.32.0`, y el worker de RunPod va en vLLM 0.32.0
  ([worker-vllm](https://github.com/runpod-workers/worker-vllm)). Que ese build cargue Qwen3.6 o Qwen3.8 no
  está verificado (la card de Qwen3.6 pide `sglang>=0.5.10` para SGLang).
- **Esfuerzo**: de 1 a 3 horas para dejar un endpoint serverless andando, con arranques en frío de varios
  minutos y facturación por GPU. Para 200 llamadas no compensa frente a menos de $1 en API.
- **Laptop**: un 27B no cabe sin una GPU de 24 GB o más y cuantización agresiva. No es opción para el
  domingo.

## Detección de capturas editadas

No encontré en las cards de Qwen3.8-27B, Gemma 4 31B ni Nemotron 3.5 Super VL una advertencia equivalente a
la de Claude ("Do not rely on it to detect fake or synthetic images",
[Claude Vision](https://platform.claude.com/docs/en/build-with-claude/vision)). Que no lo digan no significa
que puedan hacerlo: ninguna card reporta un benchmark de detección de manipulación. Gemma solo trae
limitaciones genéricas de "Factual Accuracy" ([card](https://huggingface.co/google/gemma-4-31B-it)). Lo que
sí está escrito, en la doc de DeepInfra: "When forced to produce structured output, some models are more
likely to hallucinate values rather than say 'I don't know'"
([JSON mode, Caveats](https://deepinfra.com/docs/advanced/json_mode)). Eso pega justo en `reference` y
`amount`. El prompt actual ya permite `""` y pide `confidence`; lo que protege de verdad sigue siendo
`UNIQUE (metodo, referencia)`, la comparación de monto y destinatario, y que Mau mire su banco.

## Plan de prueba para el domingo (unos 20 minutos)

1. Crea la clave de OpenRouter, cárgala con `supabase secrets set` y despliega con `qwen/qwen3.6-27b`.
2. Corre de 8 a 10 capturas reales (BNC, Mercantil, Banesco, Provincial, Binance, Zelle) y compara a ojo
   `amount`, `reference` y `recipientPhone`.
3. Repite con `OCR_MODEL=qwen/qwen3.8-27b` y con `nvidia/nemotron-3.5-super-vl`, y quédate con el que no
   falle dígitos.

## Lo que no encontré o no pude verificar

- **Ninguna llamada real**: sin claves, no probé imagen en base64 más `json_schema` en ningún proveedor. Que
  cada endpoint de OpenRouter acepte imagen sale del modelo (`input_modalities`), no de cada endpoint.
- `reasoning: { enabled: false }` con `qwen/qwen3.6-27b`: OpenRouter no publica `supported_efforts` para
  ese modelo (para Qwen3.8 sí, e incluye `none`). Si el razonamiento no se apaga, el `max_tokens: 2000`
  amortigua el problema.
- `data_collection: "deny"` combinado con el filtro de cuantización puede dejar cero proveedores. Si la
  llamada devuelve "no endpoints", quita `data_collection` primero.
- El endpoint de DeepInfra para `qwen/qwen3.8-27b` en OpenRouter tenía `status: -2`, un valor sin
  documentar. Probablemente indica que estaba degradado.
- Groq y Fireworks: sin datos (doc con 403 y `/models` con clave).
- Together: base64 y la base URL exacta no verificados; la doc de visión solo muestra URL.
- Gemma en la Gemini API: no verifiqué si acepta `json_schema`.
- Los tokens por imagen de cada modelo; el costo es una estimación.
- Mistral Small 4, MiniCPM-V 4.7, DeepSeek-V4-Flash-Vision-Exp e InternVL3.5: no revisé sus cifras de OCR.
- Ningún benchmark público cubre comprobantes venezolanos ni montos con coma decimal. Las cifras de arriba
  solo ordenan candidatos; no prometen precisión en este caso.
