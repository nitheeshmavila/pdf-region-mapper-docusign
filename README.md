# PDF Region Selector Web App

A browser-based PDF region selector application that replaces desktop OpenCV tools. Users can upload PDFs, draw rectangular regions on pages, and map them to predefined field names with DocuSign-compatible normalized coordinates.

## 🎯 Features

- **PDF Rendering**: Uses pdf.js for client-side PDF rendering (no server-side conversion needed)
- **Interactive Drawing**: Mouse-based rectangle drawing on PDF pages
- **Field Mapping**: Map drawn regions to predefined field names
- **Page Navigation**: Navigate between pages with buttons or keyboard shortcuts (← → or n/p)
- **Coordinate Normalization**: Automatically normalizes coordinates to 0-1000 scale (DocuSign compatible)
- **Visual Feedback**: Color-coded field status (unmapped, mapped on current page, mapped on other pages)
- **Production Ready**: Clean architecture, error handling, and validation

## 🏗️ Architecture

### Frontend
- **React** + **Vite** for fast development
- **pdf.js** for PDF rendering in the browser
- **HTML Canvas** for rectangle drawing overlay
- Responsive, modern UI

### Backend
- **FastAPI** for REST API
- Stateless design (no session management)
- Validates and saves field mappings in DocuSign format
- Dockerized for easy deployment

### Deployment
- Frontend → **Vercel** (free tier)
- Backend → **Render** (Docker, free tier)

## 📦 Installation

### Prerequisites
- Node.js 18+ and npm
- Python 3.10+
- Docker (for backend deployment)

### Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

Frontend will run on `http://localhost:3000`

### Backend Setup

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 10000
```

Backend will run on `http://localhost:10000`

For Docker:

```bash
cd backend
docker build -t pdf-region-backend .
docker run -p 10000:10000 pdf-region-backend
```

## 🚀 Usage

1. **Upload PDF**: Click "Upload PDF" and select a PDF file
2. **Select Field**: Click on a field name in the sidebar
3. **Draw Rectangle**: Click and drag on the PDF page to draw a rectangle
4. **Navigate Pages**: Use arrow buttons or keyboard (← → or n/p) to move between pages
5. **Map More Fields**: Repeat steps 2-3 for additional fields
6. **Save**: Click "Save Fields" to save all mappings to the backend

## 📐 Coordinate Format

Coordinates are normalized to a 0-1000 scale (DocuSign compatible):

```json
{
  "Field Name": [y1, x1, y2, x2, pageNumber]
}
```

Where:
- `y1, x1`: Top-left corner (normalized 0-1000)
- `y2, x2`: Bottom-right corner (normalized 0-1000)
- `pageNumber`: 1-indexed page number

Example:
```json
{
  "Annual Income": [120, 340, 180, 720, 1]
}
```

## 🔧 Configuration

### Frontend Environment Variables

Create `frontend/.env`:

```env
VITE_BACKEND_URL=http://localhost:10000
```

For production, set to your Render backend URL.

### Backend

The backend runs on port `10000` by default (Render compatible). Saved field mappings are stored in the `outputs/` directory.

## 📁 Project Structure

```
pdf-region-webapp/
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── PDFViewer.jsx      # PDF rendering with pdf.js
│   │   │   └── FieldList.jsx      # Field selection UI
│   │   ├── App.jsx                # Main application logic
│   │   ├── App.css                # Styles
│   │   └── main.jsx               # Entry point
│   ├── package.json
│   └── vite.config.js
├── backend/
│   ├── main.py                    # FastAPI application
│   ├── requirements.txt
│   ├── Dockerfile
│   ├── uploads/                   # PDF images (legacy)
│   └── outputs/                   # Saved field mappings
└── README.md
```

## 🧪 API Endpoints

### `POST /upload`
Legacy endpoint for PDF upload and image conversion. Frontend now uses pdf.js, but this remains for backward compatibility.

### `POST /save-fields`
Save field mappings in DocuSign format.

**Request:**
```json
{
  "Annual Income": [120, 340, 180, 720, 1],
  "Date of Birth": [200, 100, 250, 400, 1]
}
```

**Response:**
```json
{
  "status": "saved",
  "filename": "outputs/fields_20240101_120000.json",
  "fields_count": 2,
  "timestamp": "2024-01-01T12:00:00"
}
```

### `GET /fields/latest`
Get the most recently saved field mappings.

## 🎨 Default Fields

The application comes with predefined fields:
- Annual Income
- Date of Birth
- Social Security Number
- Address
- Phone Number
- Email
- Employment Status
- Bank Account Number
- Signature
- Date

You can customize these in `frontend/src/App.jsx` (modify the `DEFAULT_FIELDS` array).

## 🚢 Deployment

### Frontend (Vercel)

1. Push code to GitHub
2. Import project in Vercel
3. Set build command: `cd frontend && npm install && npm run build`
4. Set output directory: `frontend/dist`
5. Add environment variable: `VITE_BACKEND_URL=https://your-backend.onrender.com`

### Backend (Render)

1. Push code to GitHub
2. Create new Web Service in Render
3. Connect your repository
4. Set:
   - **Build Command**: (leave empty, Docker handles it)
   - **Start Command**: (leave empty, Docker handles it)
   - **Dockerfile Path**: `backend/Dockerfile`
5. Deploy!

## 🔒 Security Notes

- CORS is currently open (`allow_origins=["*"]`) for development. Restrict in production.
- No authentication implemented (add if needed for production)
- File uploads are not validated (add validation for production)

## 🐛 Troubleshooting

**PDF not rendering?**
- Ensure pdf.js worker is loading (check browser console)
- Verify PDF file is not corrupted

**Can't draw rectangles?**
- Make sure a field is selected first
- Check browser console for errors

**Backend connection failed?**
- Verify backend is running on port 10000
- Check `VITE_BACKEND_URL` environment variable
- Ensure CORS is configured correctly

## 📝 License

MIT

## 🙏 Acknowledgments

- Built to replace desktop OpenCV tools with a modern web solution
- Uses pdf.js for client-side PDF rendering
- DocuSign-compatible coordinate format

