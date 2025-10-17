from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
import gpxpy, io, math

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# simple test endpoint
@app.get("/health")
def health():
    return {"status": "ok"}

def haversine_m(lat1, lon1, lat2, lon2):
    R = 6371000
    φ1, φ2 = math.radians(lat1), math.radians(lat2)
    dφ = math.radians(lat2 - lat1)
    dλ = math.radians(lon2 - lon1)
    a = math.sin(dφ/2)**2 + math.cos(φ1)*math.cos(φ2)*math.sin(dλ/2)**2
    return 2 * R * math.asin(math.sqrt(a))

@app.post("/ingest")
async def ingest(file: UploadFile = File(...)):
    """Parse a GPX file and return its points + stats"""
    gpx = gpxpy.parse(io.StringIO((await file.read()).decode()))
    pts = []
    total = 0
    for trk in gpx.tracks:
        for seg in trk.segments:
            prev = None
            for p in seg.points:
                if prev:
                    total += haversine_m(prev.latitude, prev.longitude, p.latitude, p.longitude)
                pts.append(dict(lat=p.latitude, lon=p.longitude, ele=p.elevation))
                prev = p
    return {"points": pts, "stats": {"distance_km": round(total/1000,2), "count": len(pts)}}
