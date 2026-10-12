import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { ChangeEvent, useEffect, useState } from "react";
import { CheckCircle2, Loader2, MapPinned, Send, MapPin, Building2, Copy, ArrowRight, ShieldCheck, AlertTriangle, ThumbsUp } from "lucide-react";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import ExifReader from "exifreader";
import Tesseract from "tesseract.js";
import { grievancesApi, departmentsApi, districtsApi, getToken } from "@/api";
import type { Department, District, Taluk } from "@/types";

const categories = ["roads", "sanitation", "water", "electricity", "drainage", "other"] as const;

const categoryLabels: Record<(typeof categories)[number], string> = {
  roads: "Roads (PWD)",
  sanitation: "Sanitation & Waste",
  water: "Water Supply & Sewerage",
  electricity: "Electricity Board",
  drainage: "Urban Drainage",
  other: "Other Grievances",
};

export const Route = createFileRoute("/submit")({
  beforeLoad: ({ location }) => {
    if (!getToken()) {
      throw redirect({
        to: "/login",
        search: { redirect: location.href },
      });
    }
  },
  head: () => ({ meta: [{ title: "Submit Complaint — PGMS Karnataka" }] }),
  component: SubmitComplaintPage,
});

interface GpsData {
  latitude: number | null;
  longitude: number | null;
  altitude: number | null;
  found: boolean;
  city?: string | null;
  method?: string;
}

async function extractGpsFromPhoto(file: File): Promise<GpsData> {
  const gpsData: GpsData = { latitude: null, longitude: null, altitude: null, found: false, city: null };

  try {
    const arrayBuffer = await file.arrayBuffer();

    // Tier 1: Standard EXIF metadata extraction via ExifReader
    try {
      const tags = ExifReader.load(arrayBuffer, { expanded: true });
      if (tags.gps && typeof tags.gps.Latitude === "number" && typeof tags.gps.Longitude === "number") {
        gpsData.latitude = tags.gps.Latitude;
        gpsData.longitude = tags.gps.Longitude;
        gpsData.found = true;
        gpsData.method = "EXIF Header";
        return gpsData;
      }
    } catch (exifErr) {
      console.warn("ExifReader extraction warning:", exifErr);
    }

    // Tier 2: Binary text / ASCII metadata regex scan
    const bytes = new Uint8Array(arrayBuffer);
    let rawText = "";
    const step = bytes.length > 500000 ? 2 : 1;
    for (let i = 0; i < bytes.length; i += step) {
      const charCode = bytes[i];
      if (charCode >= 32 && charCode <= 126) {
        rawText += String.fromCharCode(charCode);
      }
    }

    const latMatch = rawText.match(/lat(?:itude)?\s*[:\s=]*(-?\d{1,2}\.\d{3,8})/i);
    const lngMatch = rawText.match(/lon[g|titude]*\s*[:\s=]*(-?\d{1,3}\.\d{3,8})/i);
    const cityMatch = rawText.match(/(Tumak?uru?|Bengaluru|Bangalore|Chitradurga|Mysuru|Mysore|Mangaluru|Belagavi|Hubballi|Shivamogga|Davangere|Ballari|Vijayapura)/i);

    if (latMatch && lngMatch) {
      gpsData.latitude = parseFloat(latMatch[1]);
      gpsData.longitude = parseFloat(lngMatch[1]);
      gpsData.found = true;
      gpsData.method = "Image Metadata Text";
      if (cityMatch) gpsData.city = cityMatch[0];
      return gpsData;
    }

    if (cityMatch) {
      gpsData.city = cityMatch[0];
    }

    // Tier 3: Client-side OCR scan via Tesseract.js (for GPS Map Camera overlays on photo canvas)
    const fileUrl = URL.createObjectURL(file);
    try {
      const { data } = await Tesseract.recognize(fileUrl, "eng");
      const ocrText = data.text || "";

      const ocrLat = ocrText.match(/lat(?:itude)?\s*[:\s=]*(-?\d{1,2}\.\d{3,8})/i);
      const ocrLng = ocrText.match(/lon[g|titude]*\s*[:\s=]*(-?\d{1,3}\.\d{3,8})/i);
      const ocrCity = ocrText.match(/(Tumak?uru?|Bengaluru|Bangalore|Chitradurga|Mysuru|Mysore|Mangaluru|Belagavi|Hubballi|Shivamogga|Davangere|Ballari|Vijayapura)/i);

      if (ocrLat && ocrLng) {
        gpsData.latitude = parseFloat(ocrLat[1]);
        gpsData.longitude = parseFloat(ocrLng[1]);
        gpsData.found = true;
        gpsData.method = "Photo Stamp OCR";
        if (ocrCity) gpsData.city = ocrCity[0];
        return gpsData;
      }

      if (ocrCity && !gpsData.city) {
        gpsData.city = ocrCity[0];
      }
    } finally {
      URL.revokeObjectURL(fileUrl);
    }
  } catch (error) {
    console.warn("GPS extraction error:", error);
  }

  return gpsData;
}

async function reverseGeocodeCoordinates(lat: number, lng: number): Promise<{ address: string; landmark: string; district: string; city: string }> {
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`, {
      headers: { "Accept-Language": "en" },
    });
    if (!res.ok) return { address: "", landmark: "", district: "", city: "" };
    const data = await res.json();
    const addr = data.display_name || "";
    const landmark = data.address?.road || data.address?.suburb || data.address?.neighbourhood || data.address?.amenity || "";
    const district = data.address?.state_district || data.address?.county || data.address?.district || "";
    const city = data.address?.city || data.address?.town || data.address?.village || data.address?.suburb || data.address?.municipality || "";
    return { address: addr, landmark, district, city };
  } catch {
    return { address: "", landmark: "", district: "", city: "" };
  }
}

function SubmitComplaintPage() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [districts, setDistricts] = useState<District[]>([]);
  const [taluks, setTaluks] = useState<Taluk[]>([]);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<"" | (typeof categories)[number]>("");
  const [departmentId, setDepartmentId] = useState("");
  const [districtId, setDistrictId] = useState("");
  const [talukId, setTalukId] = useState("");
  const [address, setAddress] = useState("");
  const [landmark, setLandmark] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");

  const [photo, setPhoto] = useState<File | null>(null);
  const [photoGpsData, setPhotoGpsData] = useState<GpsData | null>(null);
  const [photoValidating, setPhotoValidating] = useState(false);
  const [resolvingAddress, setResolvingAddress] = useState(false);
  const [locating, setLocating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successId, setSuccessId] = useState<string | null>(null);

  const [nearbyGrievances, setNearbyGrievances] = useState<any[]>([]);
  const [upvotingId, setUpvotingId] = useState<string | null>(null);
  const [upvotedSuccess, setUpvotedSuccess] = useState<{ id: string; title: string; count: number } | null>(null);

  useEffect(() => {
    departmentsApi
      .getDepartments()
      .then((records) => setDepartments(records))
      .catch(() => setDepartments([]));

    districtsApi
      .getDistricts()
      .then((records) => setDistricts(records))
      .catch(() => setDistricts([]));
  }, []);

  const handleDistrictChange = (dId: string) => {
    setDistrictId(dId);
    setTalukId("");
    if (dId) {
      districtsApi
        .getTaluks(dId)
        .then((records) => setTaluks(records))
        .catch(() => setTaluks([]));
    } else {
      setTaluks([]);
    }
  };

  async function triggerReverseGeocode(latVal: number, lngVal: number, photoCityHint?: string | null) {
    setResolvingAddress(true);

    let activeDistricts = districts;
    if (activeDistricts.length === 0) {
      try {
        activeDistricts = await districtsApi.getDistricts();
        setDistricts(activeDistricts);
      } catch (e) {}
    }

    const resolved = await reverseGeocodeCoordinates(latVal, lngVal);
    setResolvingAddress(false);

    if (resolved.address) {
      setAddress(resolved.address);
      if (resolved.landmark) setLandmark(resolved.landmark);
    } else {
      setAddress(`GPS Location (${latVal.toFixed(5)}, ${lngVal.toFixed(5)})`);
    }

    // Dynamic search text combining all reverse-geocoded location tokens
    const fullLocationText = [
      resolved.district,
      resolved.city,
      resolved.address,
      photoCityHint || ""
    ].filter(Boolean).join(" ").toLowerCase();

    // Dynamically match against backend Districts API database
    const matchedDist = activeDistricts.find((d) => {
      const dName = d.name.toLowerCase();
      const coreName = dName.replace(/\s*(district|urban|rural)\s*/gi, "").trim();

      if (fullLocationText.includes(dName)) return true;
      if (coreName.length > 2 && fullLocationText.includes(coreName)) return true;

      // Common phonetic/spelling variations in Karnataka
      if (coreName.includes("tumakuru") && fullLocationText.includes("tumkur")) return true;
      if (coreName.includes("bengaluru") && fullLocationText.includes("bangalore")) return true;
      if (coreName.includes("mysuru") && fullLocationText.includes("mysore")) return true;
      if (coreName.includes("belagavi") && fullLocationText.includes("belgaum")) return true;
      if (coreName.includes("kalaburagi") && fullLocationText.includes("gulbarga")) return true;
      if (coreName.includes("shivamogga") && fullLocationText.includes("shimoga")) return true;
      if (coreName.includes("mangaluru") && fullLocationText.includes("mangalore")) return true;

      return false;
    });

    if (matchedDist) {
      setDistrictId(matchedDist.id);
      setTalukId("");
      districtsApi
        .getTaluks(matchedDist.id)
        .then((records) => {
          setTaluks(records);
          if (records.length > 0) {
            const matchedTaluk = records.find((t) => fullLocationText.includes(t.name.toLowerCase())) || records[0];
            setTalukId(matchedTaluk.id);
          }
        })
        .catch(() => setTaluks([]));

      toast.success(`Auto-detected Jurisdiction: ${matchedDist.name} District`);
    } else if (resolved.address) {
      toast.info("Location address resolved! Please select District from dropdown.");
    }

    // Check nearby grievances for duplicates
    try {
      const nearby = await grievancesApi.getNearbyGrievances(latVal, lngVal);
      if (nearby && nearby.length > 0) {
        setNearbyGrievances(nearby);
        toast.warning("⚠️ Similar open complaint found nearby! You can upvote it to increase priority.");
      } else {
        setNearbyGrievances([]);
      }
    } catch (e) {
      setNearbyGrievances([]);
    }
  }

  async function handleUpvote(grievanceId: string) {
    setUpvotingId(grievanceId);
    try {
      const res = await grievancesApi.upvoteGrievance(grievanceId);
      const targetItem = nearbyGrievances.find((g) => g.id === grievanceId);
      toast.success(`Upvoted! Priority score increased to ${res.upvotes} for Nodal Officers.`);
      setUpvotedSuccess({
        id: grievanceId,
        title: targetItem?.title || "Nearby Complaint",
        count: res.upvotes,
      });
    } catch (err: any) {
      toast.error(err?.message || "Could not upvote complaint.");
    } finally {
      setUpvotingId(null);
    }
  }

  function handleApplyPhotoGps() {
    if (photoGpsData && photoGpsData.found && photoGpsData.latitude !== null && photoGpsData.longitude !== null) {
      const lat = photoGpsData.latitude;
      const lng = photoGpsData.longitude;
      setLatitude(lat.toFixed(6));
      setLongitude(lng.toFixed(6));
      triggerReverseGeocode(lat, lng, photoGpsData.city);
      toast.success("Applied GPS location from photo!");
    }
  }

  function handleGetLocation() {
    if (!navigator.geolocation) {
      setError("Geolocation is not supported by your browser.");
      return;
    }

    setLocating(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setLatitude(lat.toFixed(6));
        setLongitude(lng.toFixed(6));
        setLocating(false);
        await triggerReverseGeocode(lat, lng);
      },
      (geoError) => {
        setLocating(false);
        setError(`Location error: ${geoError.message}`);
      }
    );
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSuccessId(null);

    if (!photo) {
      setError("Photo proof is required. Please upload a JPEG image of the issue.");
      return;
    }

    if (!districtId) {
      setError("Please select the District for this grievance.");
      return;
    }

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("title", title);
      formData.append("description", description);
      formData.append("category", category);
      if (departmentId) formData.append("departmentId", departmentId);
      if (districtId) formData.append("districtId", districtId);
      if (talukId) formData.append("talukId", talukId);
      if (address) formData.append("address", address);
      if (landmark) formData.append("landmark", landmark);
      
      const parsedLat = parseFloat(latitude);
      const parsedLng = parseFloat(longitude);
      if (!isNaN(parsedLat) && !isNaN(parsedLng)) {
        formData.append("latitude", String(parsedLat));
        formData.append("longitude", String(parsedLng));
      }

      formData.append("images", photo);

      const record = await grievancesApi.createGrievance(formData);

      setSuccessId(record.id);
      toast.success("Complaint Submitted Successfully!", {
        description: `Tracking Ref: KAR-2026-${record.id.slice(0, 8).toUpperCase()}`,
      });
      setTitle("");
      setDescription("");
      setCategory("");
      setPhoto(null);
      setPhotoGpsData(null);
      setLatitude("");
      setLongitude("");
      setAddress("");
      setLandmark("");
      setDepartmentId("");
      setDistrictId("");
      setTalukId("");
    } catch (submitError: any) {
      setError(submitError?.message ?? "Could not submit complaint. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handlePhotoChange(event: ChangeEvent<HTMLInputElement>) {
    setError(null);
    setPhoto(null);
    setPhotoGpsData(null);

    const selectedFile = event.target.files?.[0] ?? null;
    if (!selectedFile) return;

    setPhotoValidating(true);
    toast.info("Scanning photo for GPS metadata & location...", { duration: 3000 });

    try {
      const gpsData = await extractGpsFromPhoto(selectedFile);
      setPhotoValidating(false);
      setPhotoGpsData(gpsData);
      setPhoto(selectedFile);

      if (gpsData.found && gpsData.latitude !== null && gpsData.longitude !== null) {
        setLatitude(gpsData.latitude.toFixed(6));
        setLongitude(gpsData.longitude.toFixed(6));
        toast.success(`Extracted Photo Location via ${gpsData.method || "GPS"}! Auto-detecting jurisdiction...`);
        await triggerReverseGeocode(gpsData.latitude, gpsData.longitude, gpsData.city);
      } else if (gpsData.city) {
        let activeDistricts = districts;
        if (activeDistricts.length === 0) {
          try {
            activeDistricts = await districtsApi.getDistricts();
            setDistricts(activeDistricts);
          } catch (e) {}
        }
        const cName = gpsData.city.toLowerCase();
        const matchedDist = activeDistricts.find((d) => {
          const dName = d.name.toLowerCase();
          if (cName.includes("tumkur") && dName.includes("tumakuru")) return true;
          if (cName.includes("bangalore") && dName.includes("bengaluru")) return true;
          if (cName.includes("mysore") && dName.includes("mysuru")) return true;
          return dName.includes(cName) || cName.includes(dName);
        });
        if (matchedDist) {
          setDistrictId(matchedDist.id);
          setTalukId("");
          districtsApi
            .getTaluks(matchedDist.id)
            .then((records) => {
              setTaluks(records);
              if (records.length > 0) setTalukId(records[0].id);
            })
            .catch(() => setTaluks([]));
          setAddress(`${matchedDist.name}, Karnataka, India`);
          toast.success(`Auto-detected ${matchedDist.name} District from photo location stamp!`);
        } else {
          toast.info("Photo selected. Please select District & Taluk for this issue below.");
        }
      } else {
        toast.info("Photo selected. Please select District & Taluk for this issue below.");
      }
    } catch (validationError) {
      setPhotoValidating(false);
      event.target.value = "";
      setError("Error reading photo. Please try another photo.");
    }
  }

  return (
    <Layout>
      <section className="mx-auto max-w-4xl px-4 py-10 md:py-14">
        <div className="max-w-2xl mb-8 md:mb-10">
          <h1 className="font-display text-2xl md:text-3xl">Submit a Public Complaint</h1>
          <p className="mt-2 md:mt-3 text-sm md:text-base text-muted-foreground">
            Fill the details and upload a photo as proof. The system auto-detects your District, Taluk, and exact street address.
          </p>
        </div>

        <div className="mt-6 md:mt-8">
          {upvotedSuccess ? (
            <Card className="border-amber-500/40 bg-amber-50/50 dark:bg-amber-950/20 text-center py-10 px-6 shadow-md">
              <CardContent className="space-y-6 max-w-lg mx-auto">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/50 text-amber-600 dark:text-amber-400">
                  <ThumbsUp className="h-10 w-10" />
                </div>
                <div>
                  <h2 className="font-display text-2xl font-bold text-foreground">Nearby Complaint Upvoted & Joined!</h2>
                  <p className="mt-2 text-sm text-muted-foreground">
                    You successfully upvoted the existing report <strong>"{upvotedSuccess.title}"</strong>. No duplicate complaint was created. Priority has been escalated for Nodal Officers!
                  </p>
                </div>

                <div className="rounded-xl border border-amber-300 dark:border-amber-800 bg-background p-4 shadow-xs space-y-3 text-left">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground text-xs font-semibold uppercase">Official Tracking Code</span>
                    <Badge variant="outline" className="text-amber-700 dark:text-amber-300 border-amber-400 font-mono font-bold text-sm px-2.5 py-0.5">
                      KAR-2026-{upvotedSuccess.id.slice(0, 8).toUpperCase()}
                    </Badge>
                  </div>
                  <div className="text-xs text-muted-foreground pt-2 border-t border-border flex items-center justify-between">
                    <span>Total Community Priority:</span>
                    <Badge className="bg-amber-500/20 text-amber-800 dark:text-amber-300 font-bold text-xs">
                      🔥 {upvotedSuccess.count} Citizens Upvoted
                    </Badge>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
                  <Button asChild size="default" className="bg-amber-600 hover:bg-amber-700 text-white font-medium">
                    <Link to="/dashboard">
                      Open Dashboard <ArrowRight className="h-4 w-4 ml-1.5" />
                    </Link>
                  </Button>
                  <Button
                    variant="outline"
                    size="default"
                    onClick={() => setUpvotedSuccess(null)}
                  >
                    Submit a Separate Complaint
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : successId ? (
            <Card className="border-emerald-500/40 bg-emerald-50/50 dark:bg-emerald-950/20 text-center py-10 px-6 shadow-md">
              <CardContent className="space-y-6 max-w-lg mx-auto">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="h-10 w-10" />
                </div>
                <div>
                  <h2 className="font-display text-2xl font-bold text-foreground">Grievance Submitted Successfully!</h2>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Your complaint has been registered with the Karnataka Public Grievance Portal and routed to the jurisdiction department.
                  </p>
                </div>

                <div className="rounded-xl border border-emerald-300 dark:border-emerald-800 bg-background p-4 shadow-xs space-y-3 text-left">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground text-xs font-semibold uppercase">Official Tracking Code</span>
                    <Badge variant="outline" className="text-emerald-700 dark:text-emerald-300 border-emerald-400 font-mono font-bold text-sm px-2.5 py-0.5">
                      KAR-2026-{successId.slice(0, 8).toUpperCase()}
                    </Badge>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
                  <Button asChild size="default" className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium">
                    <Link to="/my-complaints">
                      View My Complaints <ArrowRight className="h-4 w-4 ml-1.5" />
                    </Link>
                  </Button>
                  <Button
                    variant="outline"
                    size="default"
                    onClick={() => setSuccessId(null)}
                  >
                    File Another Complaint
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-border shadow-[var(--shadow-soft)]">
              <CardContent className="p-5 md:p-7">
                <form onSubmit={onSubmit} className="space-y-5 md:space-y-6">
                  {error ? (
                    <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                      {error}
                    </div>
                  ) : null}

                <div className="space-y-2">
                  <Label htmlFor="title">Complaint Title</Label>
                  <Input
                    id="title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Example: Water pipe leakage near NES bus stop"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Detailed Description</Label>
                  <Textarea
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Describe the issue clearly, what is happening, and how severe it is."
                    className="min-h-24"
                    required
                  />
                </div>

                {/* 1. Photo Proof Input (Upload Image FIRST) */}
                <div className="space-y-3 rounded-lg border border-primary/20 bg-primary/5 p-4">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="photo" className="font-bold text-sm text-foreground flex items-center gap-1.5">
                      📸 Step 1: Upload Complaint Photo Proof (Auto-Extracts GPS)
                    </Label>
                    <Badge variant="outline" className="text-[10px] bg-background">JPEG / JPG Header</Badge>
                  </div>

                  <Input
                    id="photo"
                    type="file"
                    accept="image/jpeg,image/jpg"
                    capture="environment"
                    onChange={handlePhotoChange}
                    className="cursor-pointer bg-background text-xs md:text-sm"
                  />

                  {photoValidating && <p className="text-xs text-muted-foreground flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" /> Extracting photo EXIF GPS header...</p>}
                  {resolvingAddress && <p className="text-xs text-primary font-medium flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin text-primary" /> Auto-detecting District, Taluk & Street Address from photo location...</p>}
                  {photo && <p className="text-xs text-emerald-600 font-semibold">Selected Image: {photo.name}</p>}
                </div>

                {/* Nearby Duplicate Warning & Upvote Box */}
                {nearbyGrievances.length > 0 && (
                  <div className="rounded-xl border border-amber-400/60 bg-amber-50/70 dark:bg-amber-950/30 p-4 space-y-3 shadow-sm">
                    <div className="flex items-start gap-2.5">
                      <div className="rounded-full bg-amber-200 dark:bg-amber-900 p-1.5 text-amber-800 dark:text-amber-200 shrink-0 mt-0.5">
                        <AlertTriangle className="h-4 w-4" />
                      </div>
                      <div className="space-y-0.5 flex-1">
                        <h4 className="font-bold text-xs md:text-sm text-foreground">
                          Similar Complaint Already Reported Nearby!
                        </h4>
                        <p className="text-[11px] md:text-xs text-muted-foreground">
                          A similar issue was recently reported in this area. Upvote the existing report to increase priority for Nodal Officers instead of filing a duplicate.
                        </p>
                      </div>
                    </div>

                    <div className="space-y-2 pt-2 border-t border-amber-200 dark:border-amber-900/40">
                      {nearbyGrievances.map((item) => (
                        <div key={item.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 p-3 rounded-lg bg-background border border-amber-200/80 dark:border-amber-900/50 shadow-2xs">
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-xs text-foreground">{item.title}</span>
                              <Badge variant="outline" className="text-[10px] uppercase font-bold border-amber-300 text-amber-800 dark:text-amber-300">
                                {item.category || item.status}
                              </Badge>
                            </div>
                            <p className="text-[11px] text-muted-foreground line-clamp-1">{item.address || item.description}</p>
                          </div>
                          <div className="shrink-0">
                            <Button
                              type="button"
                              size="sm"
                              className="bg-amber-600 hover:bg-amber-700 text-white gap-1 text-xs font-semibold h-8"
                              disabled={upvotingId === item.id}
                              onClick={() => handleUpvote(item.id)}
                            >
                              {upvotingId === item.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ThumbsUp className="h-3.5 w-3.5" />}
                              Upvote & Join ({item.upvotes || 1})
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 2. Category & Department Selection */}
                <div className="grid gap-5 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="category">Category</Label>
                    <Select value={category} onValueChange={(val) => setCategory(val as typeof category)}>
                      <SelectTrigger id="category" className="h-10 text-sm">
                        <SelectValue placeholder="Select Category" />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map((item) => (
                          <SelectItem key={item} value={item}>
                            {categoryLabels[item]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="department">Responsible Department (Optional)</Label>
                    <Select value={departmentId} onValueChange={setDepartmentId}>
                      <SelectTrigger id="department" className="h-10 text-sm">
                        <SelectValue placeholder="Auto-assign to Department" />
                      </SelectTrigger>
                      <SelectContent>
                        {departments.map((d) => (
                          <SelectItem key={d.id} value={d.id}>
                            {d.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* 3. Auto-Detected Jurisdiction (District & Taluk) */}
                <div className="grid gap-5 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="district" className="flex items-center gap-1.5 font-semibold">
                      <Building2 className="h-4 w-4 text-primary" /> District (Auto-Selected from Photo Location)
                    </Label>
                    <Select value={districtId} onValueChange={handleDistrictChange}>
                      <SelectTrigger id="district" className="h-10 text-sm">
                        <SelectValue placeholder="Select District" />
                      </SelectTrigger>
                      <SelectContent className="max-h-60 overflow-y-auto">
                        {districts.map((d) => (
                          <SelectItem key={d.id} value={d.id}>
                            {d.name} ({d.state})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="taluk" className="flex items-center gap-1.5 font-semibold">
                      <MapPin className="h-4 w-4 text-primary" /> Taluk / Municipal Jurisdiction
                    </Label>
                    <Select value={talukId} onValueChange={setTalukId} disabled={!districtId}>
                      <SelectTrigger id="taluk" className="h-10 text-sm">
                        <SelectValue placeholder={districtId ? "Select Taluk / Municipal Body" : "-- Select District First --"} />
                      </SelectTrigger>
                      <SelectContent className="max-h-60 overflow-y-auto">
                        {taluks.map((t) => (
                          <SelectItem key={t.id} value={t.id}>
                            {t.name} ({t.type})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* 4. Auto-Resolved Address & Landmark */}
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="address">Resolved Street Address</Label>
                    <Input
                      id="address"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      placeholder="Street address (auto-filled from location)"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="landmark">Nearby Landmark</Label>
                    <Input
                      id="landmark"
                      value={landmark}
                      onChange={(e) => setLandmark(e.target.value)}
                      placeholder="e.g. Near Bus Stand / Opposite School"
                    />
                  </div>
                </div>

                {/* 5. Location Coordinates & Device GPS */}
                <div className="space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <Label className="font-semibold text-xs">Satellite GPS Coordinates</Label>
                    <div className="flex flex-wrap items-center gap-2">
                      {photoGpsData?.found && (
                        <Button type="button" variant="default" size="sm" onClick={handleApplyPhotoGps} className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white gap-1 font-semibold">
                          <MapPin className="h-3.5 w-3.5" /> Re-Apply Photo EXIF
                        </Button>
                      )}
                      <Button type="button" variant="outline" size="sm" onClick={handleGetLocation} disabled={locating} className="h-8 text-xs gap-1">
                        {locating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <MapPinned className="h-3.5 w-3.5" />}
                        Fetch Browser Device GPS
                      </Button>
                    </div>
                  </div>

                  <div className="grid gap-3 grid-cols-2">
                    <Input
                      placeholder="Latitude"
                      value={latitude}
                      onChange={(e) => setLatitude(e.target.value)}
                      required
                    />
                    <Input
                      placeholder="Longitude"
                      value={longitude}
                      onChange={(e) => setLongitude(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <Button type="submit" disabled={submitting} className="w-full h-11 font-semibold">
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
                  Submit Grievance to Taluk Officer
                </Button>
              </form>
            </CardContent>
          </Card>
          )}
        </div>
      </section>
    </Layout>
  );
}
