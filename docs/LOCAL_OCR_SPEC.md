# SnapClaim Local OCR Specification

> Version: 1.0.0  
> Status: Proposed  
> Target: SnapClaim 1.3.0  
> Platform: Windows First, Cross-Platform Compatible  
> Runtime: Tauri 2 + Rust + React + TypeScript

---

## 1. Overview

SnapClaim currently supports PDF recognition through:

- PDF text extraction
- QR Code recognition
- Structured data parsing

This specification introduces local image OCR capability based on PaddleOCR.js.

The goal is to allow SnapClaim to recognize text from:

- Invoice images
- Screenshots
- Scanned documents
- Travel confirmation images
- Hotel confirmation images
- Other expense-related images

The OCR process runs locally on the user's machine and does not require:

- Python
- PaddlePaddle
- Tesseract
- External OCR software
- Cloud OCR API
- Network access during OCR execution

---

# 2. Goals

## 2.1 Primary Goals

The system MUST:

1. Support local OCR for image inputs.
2. Use PaddleOCR.js as the OCR engine.
3. Use PP-OCRv5 as the initial OCR model.
4. Support Chinese, English, and numeric text.
5. Run OCR locally inside the Tauri WebView.
6. Avoid requiring users to install additional OCR software.
7. Support offline OCR after application installation.
8. Separate OCR from document-specific business parsing.
9. Provide a normalized OCR result model owned by SnapClaim.
10. Support future extension to other OCR engines.

---

## 2.2 Secondary Goals

The system SHOULD:

1. Support screenshot images.
2. Support long images containing multiple documents.
3. Support PDF pages converted to images as an OCR fallback.
4. Support future OCR Web Worker execution.
5. Support future OCR model upgrades.
6. Keep the OCR engine replaceable.

---

# 3. Non-Goals

The following features are NOT included in this version:

- Cloud OCR API integration
- Large Language Model-based document recognition
- AI-based semantic extraction
- Online OCR model updates
- Windows Native OCR
- Tesseract integration
- Automatic cloud fallback
- OCR image correction UI
- Manual OCR bounding-box editing
- Automatic QR Code recognition for image files

---

# 4. Core Design Principles

## 4.1 Local First

OCR MUST run locally.

```text
Image
  ↓
PaddleOCR.js
  ↓
ONNX Runtime Web
  ↓
Local OCR Model
  ↓
OCR Result
```
No network request is required during OCR inference.

------

## 4.2 OCR and Business Parsing Must Be Decoupled

OCR is responsible only for recognizing text.

```text
Image
  ↓
OCR
  ↓
Text + Coordinates + Confidence
```

Business parsers are responsible for understanding the document.

```text
OcrDocument
  ↓
Document Classifier
  ↓
Document Parser
  ↓
Structured Business Data
```

The OCR layer MUST NOT directly determine:

- Invoice amount
- Invoice date
- Travel type
- Departure location
- Destination
- Expense category

Those fields belong to the business parsing layer.

------

## 4.3 Engine Abstraction

The business layer MUST NOT depend directly on PaddleOCR.js.

The system SHOULD be designed around an abstract OCR engine.

```text
┌─────────────────────────┐
│      Business Layer     │
└────────────┬────────────┘
             │
             ▼
┌─────────────────────────┐
│      OcrService         │
└────────────┬────────────┘
             │
             ▼
┌─────────────────────────┐
│    PaddleOCR.js         │
└─────────────────────────┘
```

Future implementations MAY include:

```text
PaddleOcrEngine
WindowsOcrEngine
CloudOcrEngine
```

------

# 5. Technology Stack

| Component         | Technology         |
| ----------------- | ------------------ |
| Desktop Framework | Tauri 2            |
| Backend           | Rust               |
| Frontend          | React + TypeScript |
| OCR Engine        | PaddleOCR.js       |
| OCR Model         | PP-OCRv5           |
| Inference Runtime | ONNX Runtime Web   |
| Execution         | Local              |
| Initial Platform  | Windows            |
| Future Platforms  | macOS / Linux      |

------

# 6. Recognition Architecture

## 6.1 High-Level Architecture

```text
┌───────────────────────────────────────────────┐
│                  SnapClaim                    │
│                                               │
│  ┌──────────────┐                             │
│  │ React UI     │                             │
│  └──────┬───────┘                             │
│         │                                     │
│         ▼                                     │
│  ┌──────────────────────┐                     │
│  │ Recognition Service  │                     │
│  └──────┬───────────────┘                     │
│         │                                     │
│         ├────────────── PDF                   │
│         │                                     │
│         │      ┌─────────────────────┐        │
│         │      │ PDF Recognition     │        │
│         │      └─────────┬───────────┘        │
│         │                │                    │
│         │       ┌────────┼─────────┐          │
│         │       ▼        ▼         ▼          │
│         │   PDF Text   QR Code    OCR         │
│         │                           │         │
│         │                           │         │
│         └────────────── Image ──────┘         │
│                                      │        │
│                                      ▼        │
│                              ┌────────────┐   │
│                              │ PaddleOCR  │   │
│                              └─────┬──────┘   │
│                                    │          │
│                                    ▼          │
│                              OcrDocument      │
│                                    │          │
│                                    ▼          │
│                           Document Classifier │
│                                    │          │
│                                    ▼          │
│                             Business Parser   │
└───────────────────────────────────────────────┘
```

------

# 7. Input Recognition Strategy

## 7.1 PDF Recognition

PDF recognition MUST follow this strategy:

```text
PDF
 │
 ▼
Extract PDF Text
 │
 ├── Success
 │      │
 │      ▼
 │   Business Parser
 │
 └── Failure
        │
        ▼
     QR Code
        │
        ├── Success
        │      │
        │      ▼
        │   QR Parser
        │
        └── Failure
               │
               ▼
          Render PDF Page
               │
               ▼
              OCR
               │
               ▼
        Business Parser
```

PDF recognition MAY use:

1. Native PDF text
2. QR Code
3. OCR

------

## 7.2 Image Recognition

Image recognition MUST NOT perform QR Code recognition.

The image recognition pipeline is:

```text
Image
  │
  ▼
Input Validation
  │
  ▼
Image Normalization
  │
  ▼
PaddleOCR.js
  │
  ▼
OcrDocument
  │
  ▼
Document Classifier
  │
  ▼
Business Parser
```

The following pipeline is explicitly NOT allowed:

```text
Image
  ↓
QR Code
  ↓
OCR
```

The correct pipeline is:

```text
Image
  ↓
OCR
```

------

# 8. OCR Engine

## 8.1 PaddleOCR.js

The initial OCR engine MUST be PaddleOCR.js.

Recommended configuration:

```typescript
{
  lang: "ch",
  ocrVersion: "PP-OCRv5",
  worker: false,
  ortOptions: {
    backend: "auto"
  }
}
```

The initial implementation SHOULD use:

```text
worker: false
```

The OCR Worker mode MAY be introduced in a later phase.

------

# 9. OCR Service

## 9.1 Directory Structure

Recommended frontend structure:

```text
src/
├── services/
│   ├── ocr/
│   │   ├── PaddleOcrService.ts
│   │   ├── OcrService.ts
│   │   ├── types.ts
│   │   └── index.ts
│   │
│   └── recognition/
│       ├── RecognitionService.ts
│       ├── ImageRecognitionService.ts
│       └── PdfRecognitionService.ts
│
└── parsers/
    ├── DocumentClassifier.ts
    ├── InvoiceParser.ts
    ├── TravelParser.ts
    └── HotelParser.ts
```

------

## 9.2 Service Interface

```typescript
export interface OcrService {
  initialize(): Promise<void>;

  recognize(
    input: OcrInput
  ): Promise<OcrDocument>;

  dispose(): Promise<void>;
}
```

------

## 9.3 Input Type

```typescript
export type OcrInput =
  | File
  | Blob
  | ImageBitmap;
```

The initial implementation MUST support:

```text
File
Blob
```

------

# 10. OCR Lifecycle

The OCR service MUST support the following lifecycle:

```text
Created
   │
   ▼
Initializing
   │
   ├───────────────┐
   ▼               ▼
Ready           Failed
   │
   ▼
Recognizing
   │
   ├───────────────┐
   ▼               ▼
Succeeded       Failed
```

## 10.1 States

```typescript
export enum OcrServiceState {
  Created,
  Initializing,
  Ready,
  Recognizing,
  Failed,
  Disposed
}
```

------

# 11. OCR Result Model

The application MUST define its own normalized OCR result model.

The application MUST NOT expose the raw PaddleOCR.js result directly to business parsers.

------

## 11.1 Point

```typescript
export interface Point {
  x: number;
  y: number;
}
```

------

## 11.2 OCR Text Block

```typescript
export interface OcrTextBlock {
  id: string;

  text: string;

  confidence: number;

  polygon: Point[];
}
```

------

## 11.3 OCR Document

```typescript
export interface OcrDocument {
  width: number;

  height: number;

  blocks: OcrTextBlock[];

  rawText: string;

  durationMs: number;
}
```

------

## 11.4 Example

```json
{
  "width": 1920,
  "height": 1080,
  "blocks": [
    {
      "id": "block-001",
      "text": "电子发票",
      "confidence": 0.98,
      "polygon": [
        {
          "x": 100,
          "y": 100
        },
        {
          "x": 500,
          "y": 100
        },
        {
          "x": 500,
          "y": 150
        },
        {
          "x": 100,
          "y": 150
        }
      ]
    }
  ],
  "rawText": "电子发票",
  "durationMs": 530
}
```

------

# 12. OCR Processing Pipeline

```text
┌──────────────┐
│ Image Input  │
└──────┬───────┘
       │
       ▼
┌──────────────────────┐
│ Validate Input       │
└──────┬───────────────┘
       │
       ▼
┌──────────────────────┐
│ Normalize Image      │
└──────┬───────────────┘
       │
       ▼
┌──────────────────────┐
│ PaddleOCR.js         │
│                      │
│ Text Detection       │
│ Text Recognition     │
└──────┬───────────────┘
       │
       ▼
┌──────────────────────┐
│ Normalize OCR Result │
└──────┬───────────────┘
       │
       ▼
┌──────────────────────┐
│ OcrDocument          │
└──────────────────────┘
```

------

# 13. Image Input Processing

## 13.1 Supported Formats

The initial version SHOULD support:

```text
PNG
JPG
JPEG
WEBP
BMP
```

------

## 13.2 File Size

Recommended limit:

```text
Maximum file size: 10 MB
```

If the file exceeds the limit:

```text
Input
  ↓
Size Check
  ↓
Exceeded
  ↓
Return InvalidInput
```

------

## 13.3 Image Resolution

Recommended maximum resolution:

```text
MAX_WIDTH = 4096
MAX_HEIGHT = 4096
```

Processing:

```text
Image
  │
  ▼
Resolution Check
  │
  ├── Within Limit
  │      │
  │      ▼
  │     OCR
  │
  └── Exceeded
         │
         ▼
    Proportional Resize
         │
         ▼
        OCR
```

The original image MUST NOT be modified.

------

# 14. Model Resource Strategy

## 14.1 Local Distribution

OCR models MUST be distributed with the application.

The application MUST NOT require model download on first use.

Recommended resource structure:

```text
resources/
└── ocr/
    ├── detection/
    │   └── ...
    │
    └── recognition/
        └── ...
```

------

## 14.2 Runtime Structure

```text
SnapClaim
├── SnapClaim.exe
└── resources/
    └── ocr/
        ├── detection/
        └── recognition/
```

The exact model files and directory structure depend on the PaddleOCR.js model loading requirements.

The implementation MUST ensure that the same model resource path works in:

```text
Development
Production
Installed Application
```

------

# 15. Tauri Resource Configuration

OCR model files MUST be declared as Tauri application resources.

Example conceptual configuration:

```json
{
  "bundle": {
    "resources": [
      "resources/ocr/**/*"
    ]
  }
}
```

The actual path MUST be verified against the final Tauri project structure.

The application MUST NOT rely on:

```text
./models
```

or:

```text
/public/models
```

without verifying the production bundle path.

------

# 16. Model Loading

The OCR service MUST load the model during initialization.

```text
Application Start
       │
       ▼
OCR Service Created
       │
       ▼
Initialize
       │
       ▼
Load Local Model
       │
       ├── Success
       │      │
       │      ▼
       │     Ready
       │
       └── Failure
              │
              ▼
             Failed
```

The model SHOULD be initialized lazily.

Recommended behavior:

```text
Application Start
       │
       ▼
No OCR Initialization
       │
       ▼
User Imports Image
       │
       ▼
Initialize OCR
       │
       ▼
Recognize Image
```

This avoids increasing application startup time.

------

# 17. OCR Service Example

Conceptual implementation:

```typescript
import { PaddleOCR } from "@paddleocr/paddleocr-js";

export class PaddleOcrService {
  private ocr: PaddleOCR | null = null;

  private initializing: Promise<PaddleOCR> | null = null;

  async initialize(): Promise<void> {
    if (this.ocr) {
      return;
    }

    if (this.initializing) {
      await this.initializing;
      return;
    }

    this.initializing = PaddleOCR.create({
      lang: "ch",
      ocrVersion: "PP-OCRv5",
      worker: false,
      ortOptions: {
        backend: "auto"
      }
    });

    this.ocr = await this.initializing;

    this.initializing = null;
  }

  async recognize(input: File | Blob): Promise<OcrDocument> {
    await this.initialize();

    if (!this.ocr) {
      throw new Error("OCR service is not initialized");
    }

    const startTime = performance.now();

    const [result] = await this.ocr.predict(input);

    return this.normalizeResult(
      result,
      performance.now() - startTime
    );
  }

  async dispose(): Promise<void> {
    this.ocr?.dispose();

    this.ocr = null;
    this.initializing = null;
  }

  private normalizeResult(
    result: unknown,
    durationMs: number
  ): OcrDocument {
    // Convert PaddleOCR.js result
    // to SnapClaim OcrDocument.
    throw new Error("Not implemented");
  }
}
```

This code is conceptual and MUST be adapted to the actual PaddleOCR.js API version used by the project.

------

# 18. Recognition Service

The application SHOULD expose a unified recognition service.

```typescript
export interface RecognitionService {
  recognize(input: RecognitionInput): Promise<RecognitionResult>;
}
export type RecognitionInput =
  | PdfInput
  | ImageInput;
```

------

# 19. Image Recognition Service

Image recognition MUST skip QR Code recognition.

```typescript
export class ImageRecognitionService {
  async recognize(file: File): Promise<RecognitionResult> {
    const ocrDocument =
      await paddleOcrService.recognize(file);

    return documentParser.parse(ocrDocument);
  }
}
```

Pipeline:

```text
Image
  ↓
ImageRecognitionService
  ↓
PaddleOcrService
  ↓
OcrDocument
  ↓
DocumentClassifier
  ↓
DocumentParser
  ↓
RecognitionResult
```

------

# 20. PDF Recognition Service

PDF recognition retains the existing recognition capabilities.

Recommended priority:

```text
PDF
 │
 ▼
Extract Native Text
 │
 ├── Success
 │      │
 │      ▼
 │   Parse Document
 │
 └── Failure
        │
        ▼
     QR Code
        │
        ├── Success
        │      │
        │      ▼
        │   Parse QR Data
        │
        └── Failure
               │
               ▼
        Render PDF to Image
               │
               ▼
              OCR
               │
               ▼
        Parse OCR Document
```

------

# 21. Document Classification

OCR results MUST be passed to a document classifier before document-specific parsing.

```text
OcrDocument
     │
     ▼
DocumentClassifier
     │
     ├── Invoice
     ├── TrainTicket
     ├── Flight
     ├── Taxi
     ├── Hotel
     └── Unknown
```

Example:

```typescript
export enum DocumentType {
  Invoice = "invoice",
  TrainTicket = "train_ticket",
  Flight = "flight",
  Taxi = "taxi",
  Hotel = "hotel",
  Unknown = "unknown"
}
```

------

# 22. Business Parser

The parser layer converts OCR results into business data.

```text
OcrDocument
     │
     ▼
DocumentClassifier
     │
     ▼
DocumentType
     │
     ├── InvoiceParser
     ├── TravelParser
     └── HotelParser
```

Example:

```typescript
export interface DocumentParser<T> {
  parse(document: OcrDocument): T;
}
```

The parser MAY use:

- `rawText`
- `blocks`
- `confidence`
- `polygon`
- Text position
- Text order

------

# 23. Recognition Result

All recognition methods SHOULD return a unified result.

```typescript
export interface RecognitionResult {
  documentType: DocumentType;

  source: RecognitionSource;

  fields: RecognizedField[];
}
export enum RecognitionSource {
  PdfText = "pdf_text",
  QrCode = "qr_code",
  Ocr = "ocr"
}
```

------

# 24. Recognition Source

The source indicates how the document was recognized.

```text
PDF Native Text
      ↓
RecognitionSource.PdfText
PDF QR Code
      ↓
RecognitionSource.QrCode
Image OCR
      ↓
RecognitionSource.Ocr
PDF → Image → OCR
      ↓
RecognitionSource.Ocr
```

The business layer MUST NOT need to know the original file type to parse business data.

------

# 25. Error Handling

The OCR service MUST define clear error categories.

```typescript
export enum OcrErrorCode {
  InitializationFailed = "initialization_failed",

  ModelNotFound = "model_not_found",

  InvalidInput = "invalid_input",

  ImageDecodeFailed = "image_decode_failed",

  InferenceFailed = "inference_failed",

  ResultParseFailed = "result_parse_failed"
}
```

------

## 25.1 Model Not Found

```text
Model Not Found
      │
      ▼
OCR Initialization Failed
      │
      ▼
Show Error
      │
      ▼
Suggest Repair or Reinstall
```

The application MUST NOT silently download the model.

------

## 25.2 Invalid Image

```text
Invalid Image
      │
      ▼
Return InvalidInput
      │
      ▼
Show User Error
```

------

## 25.3 OCR Failure

```text
OCR Failure
      │
      ▼
Return InferenceFailed
      │
      ▼
Show User Error
```

The current version MUST NOT automatically fallback to cloud OCR.

------

# 26. UI Requirements

The UI SHOULD expose OCR status.

Recommended states:

```text
Preparing OCR
Loading OCR Model
Recognizing Image
Parsing Document
Completed
Failed
```

Example:

```text
[Loading OCR Model...]
[Recognizing Image...]
[Parsing Document...]
```

The UI MUST NOT appear frozen while OCR is running.

------

# 27. OCR Worker

The first implementation SHOULD use:

```text
worker: false
```

After the basic OCR pipeline is stable, the system MAY switch to:

```text
worker: true
```

Worker mode is intended to prevent OCR inference from blocking the UI.

Future architecture:

```text
Main Thread
     │
     ▼
OCR Worker
     │
     ▼
PaddleOCR.js
     │
     ▼
ONNX Runtime Web
```

The Worker implementation MUST be verified in:

```text
Development
Production Build
Installed Tauri Application
```

------

# 28. Performance Requirements

The initial target is:

| Metric             | Target      |
| ------------------ | ----------- |
| Maximum image size | 10 MB       |
| Maximum width      | 4096 px     |
| Maximum height     | 4096 px     |
| Single image OCR   | ≤ 5 seconds |
| OCR execution      | Local       |
| Network dependency | None        |

Performance targets are hardware-dependent.

The system SHOULD record:

```typescript
export interface OcrMetrics {
  detectionMs?: number;

  recognitionMs?: number;

  totalMs: number;
}
```

------

# 29. Logging

OCR SHOULD provide structured logs.

Example:

```text
[OCR] Initializing
[OCR] Loading model
[OCR] Model ready
[OCR] Input: invoice.png
[OCR] Size: 1920x1080
[OCR] Recognition started
[OCR] Blocks: 32
[OCR] Duration: 530ms
[OCR] Recognition completed
```

Production logging SHOULD avoid outputting sensitive invoice content.

------

# 30. Security and Privacy

OCR processing MUST be local.

The application MUST NOT upload image content to a remote service in the default OCR flow.

The system SHOULD ensure:

```text
Image
  ↓
Local Processing
  ↓
OCR Result
```

No image data leaves the device unless the user explicitly initiates another feature that requires network transmission.

------

# 31. Versioning

The OCR engine and model version SHOULD be explicitly recorded.

Example:

```typescript
export interface OcrEngineInfo {
  engine: "paddleocr.js";

  model: "PP-OCRv5";

  version: string;
}
```

This allows future debugging:

```text
OCR Engine: PaddleOCR.js
OCR Model: PP-OCRv5
SnapClaim: 1.3.0
```

------

# 32. Implementation Phases

## Phase 1: OCR Core

-  Install PaddleOCR.js
-  Prepare PP-OCRv5 model resources
-  Configure local model loading
-  Initialize PaddleOCR
-  Recognize a single image
-  Normalize OCR result
-  Implement `OcrDocument`

------

## Phase 2: Image Recognition

-  Implement `ImageRecognitionService`
-  Support PNG
-  Support JPG / JPEG
-  Support WEBP
-  Add input validation
-  Add image resolution normalization
-  Add OCR status

------

## Phase 3: Business Parsing

-  Implement `DocumentClassifier`
-  Implement invoice parser
-  Implement travel parser
-  Implement hotel parser
-  Convert OCR results into SnapClaim business objects

------

## Phase 4: PDF OCR Fallback

-  Render PDF pages into images
-  Pass rendered images to OCR
-  Reuse `PaddleOcrService`
-  Integrate OCR results with PDF recognition pipeline

------

## Phase 5: Optimization

-  Add OCR Worker
-  Improve model loading
-  Optimize image preprocessing
-  Add performance metrics
-  Reduce UI blocking
-  Verify production packaging

------

# 33. Final Architecture

```text
                         ┌──────────────┐
                         │    Input     │
                         └──────┬───────┘
                                │
                                ▼
                       ┌─────────────────┐
                       │ File Type Router│
                       └───────┬─────────┘
                               │
                ┌──────────────┴──────────────┐
                │                             │
                ▼                             ▼
              Image                          PDF
                │                             │
                ▼                             ▼
               OCR                     PDF Text Extraction
                │                             │
                │                    ┌────────┴────────┐
                │                    │                 │
                │                    ▼                 ▼
                │                 Success           Failure
                │                    │                 │
                │                    ▼                 ▼
                │                 Parser           QR Code
                │                                      │
                │                             ┌────────┴────────┐
                │                             │                 │
                │                             ▼                 ▼
                │                          Success           Failure
                │                             │                 │
                │                             ▼                 ▼
                │                          Parser         PDF → Image
                │                                               │
                │                                               ▼
                └───────────────────────────────►             OCR
                                                                │
                                                                ▼
                                                         OcrDocument
                                                                │
                                                                ▼
                                                       Document Classifier
                                                                │
                                                                ▼
                                                         Business Parser
                                                                │
                                                                ▼
                                                        Structured Result
```

------

# 34. Final Technical Decisions

| Item                 | Decision                     |
| -------------------- | ---------------------------- |
| OCR Engine           | PaddleOCR.js                 |
| OCR Model            | PP-OCRv5                     |
| Runtime              | ONNX Runtime Web             |
| Execution            | Local                        |
| Model Distribution   | Bundled with Application     |
| Network Requirement  | None for OCR                 |
| OCR Location         | Tauri WebView                |
| Business Logic       | Rust / Application Layer     |
| Image QR Recognition | Not Supported                |
| PDF QR Recognition   | Existing Capability Retained |
| PDF OCR              | Fallback Capability          |
| OCR Result           | `OcrDocument`                |
| Business Parsing     | Separate Layer               |
| Cloud OCR            | Not Included                 |
| Worker               | Future Optimization          |
| Initial Platform     | Windows                      |
| Architecture         | Cross-Platform Compatible    |

------

# 35. Acceptance Criteria

The implementation is considered complete when:

1. A user can import a supported image.
2. The image does not go through QR Code recognition.
3. PaddleOCR.js can initialize locally.
4. OCR models are available from the installed application.
5. OCR works without network access.
6. OCR returns text blocks with:
   - Text
   - Confidence
   - Polygon coordinates
7. OCR results are normalized into `OcrDocument`.
8. OCR errors are handled gracefully.
9. OCR does not permanently block the UI.
10. OCR results can be passed to document parsers.
11. Existing PDF text recognition remains functional.
12. Existing PDF QR Code recognition remains functional.
13. PDF OCR can be used as a fallback.
14. The business layer does not directly depend on PaddleOCR.js.
15. The OCR implementation can be replaced by another engine in the future.

------

# 36. Summary

SnapClaim uses a local OCR architecture based on:

```text
PaddleOCR.js
      ↓
PP-OCRv5
      ↓
ONNX Runtime Web
      ↓
Local Inference
      ↓
OcrDocument
      ↓
Document Classifier
      ↓
Business Parser
```

The recognition strategy is:

```text
Image
  ↓
OCR
PDF
  ↓
PDF Text
  ↓
QR Code
  ↓
OCR Fallback
```

The core architectural rule is:

> OCR is responsible for recognizing text. Business parsers are responsible for understanding documents.

This separation allows SnapClaim to provide offline OCR without requiring users to install external software, while keeping the system extensible for future OCR engines and document types.

```

```