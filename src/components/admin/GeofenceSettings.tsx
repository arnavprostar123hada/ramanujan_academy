import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { MapPin, Crosshair, Save, Loader2, Radar } from "lucide-react";
import { motion } from "framer-motion";

interface GeofenceRow {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  radius_meters: number;
  is_active: boolean;
}

export function GeofenceSettings() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pinning, setPinning] = useState(false);
  const [row, setRow] = useState<GeofenceRow | null>(null);
  const [name, setName] = useState("Academy");
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [radius, setRadius] = useState("100");

  useEffect(() => {
    void load();
  }, []);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("geofence_locations")
      .select("*")
      .order("created_at", { ascending: true })
      .limit(1);
    const first = data?.[0] as GeofenceRow | undefined;
    if (first) {
      setRow(first);
      setName(first.name);
      setLat(String(first.latitude));
      setLng(String(first.longitude));
      setRadius(String(first.radius_meters));
    }
    setLoading(false);
  };

  const pinCurrent = () => {
    if (!navigator.geolocation) {
      toast({ title: "Location not supported on this device", variant: "destructive" });
      return;
    }
    setPinning(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude.toFixed(7));
        setLng(pos.coords.longitude.toFixed(7));
        setPinning(false);
        toast({
          title: "Location captured",
          description: `Accuracy about ${Math.round(pos.coords.accuracy)} m`,
        });
      },
      (err) => {
        setPinning(false);
        toast({
          title: "Could not get location",
          description: err.message,
          variant: "destructive",
        });
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  };

  const save = async () => {
    const la = parseFloat(lat);
    const lo = parseFloat(lng);
    const ra = parseInt(radius, 10);
    if (Number.isNaN(la) || Number.isNaN(lo) || Number.isNaN(ra) || ra <= 0) {
      toast({ title: "Please enter a valid location and radius", variant: "destructive" });
      return;
    }
    setSaving(true);
    const payload = {
      name: name || "Academy",
      latitude: la,
      longitude: lo,
      radius_meters: ra,
      is_active: true,
    };
    const { error } = row
      ? await supabase.from("geofence_locations").update(payload).eq("id", row.id)
      : await supabase.from("geofence_locations").insert(payload);
    setSaving(false);
    if (error) {
      toast({ title: "Could not save", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Academy location saved" });
    void load();
  };

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Radar className="w-5 h-5" /> Academy Location & Attendance Radius
          </CardTitle>
          <CardDescription>
            Staff are marked present automatically when their phone is inside this boundary.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading…
            </div>
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Location name</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Academy" />
                </div>
                <div className="space-y-2">
                  <Label>Allowed radius (meters)</Label>
                  <Input
                    type="number"
                    min={20}
                    value={radius}
                    onChange={(e) => setRadius(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Latitude</Label>
                  <Input value={lat} onChange={(e) => setLat(e.target.value)} placeholder="19.0760" />
                </div>
                <div className="space-y-2">
                  <Label>Longitude</Label>
                  <Input value={lng} onChange={(e) => setLng(e.target.value)} placeholder="72.8777" />
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={pinCurrent} disabled={pinning}>
                  {pinning ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Crosshair className="w-4 h-4 mr-2" />
                  )}
                  Pin my current location
                </Button>
                <Button onClick={save} disabled={saving}>
                  {saving ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4 mr-2" />
                  )}
                  Save
                </Button>
              </div>

              {row && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground pt-2 border-t">
                  <MapPin className="w-4 h-4 text-primary" />
                  Active boundary:
                  <Badge variant="secondary">
                    {row.latitude.toFixed(5)}, {row.longitude.toFixed(5)} · {row.radius_meters} m
                  </Badge>
                </div>
              )}

              <p className="text-xs text-muted-foreground">
                Tip: stand at the academy gate and tap “Pin my current location” for the most accurate
                boundary. A radius of 80–150 m works well for most buildings.
              </p>
            </>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
