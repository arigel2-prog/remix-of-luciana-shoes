import { useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { ArrowLeft, Save, Upload, Trash2, Gem, Loader2, ZoomIn } from "lucide-react";
import { ImageLightbox } from "@/components/ImageLightbox";

export default function StyleDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  const { data: style, isLoading } = useQuery({
    queryKey: ["style", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("styles")
        .select("*")
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const [form, setForm] = useState<Record<string, any>>({});

  // Merge style data into form on load
  const merged = { ...style, ...form };

  const updateStyle = useMutation({
    mutationFn: async () => {
      if (!id || !Object.keys(form).length) return;
      const { error } = await supabase.from("styles").update(form).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["style", id] });
      queryClient.invalidateQueries({ queryKey: ["styles"] });
      setForm({});
      toast.success("Style updated successfully");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteStyle = useMutation({
    mutationFn: async () => {
      if (!id) return;
      const { error } = await supabase.from("styles").update({ is_active: false }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["styles"] });
      toast.success("Style deactivated");
      navigate("/catalog");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !id) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `${id}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("style-images")
        .upload(path, file, { upsert: true });
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from("style-images").getPublicUrl(path);
      const image_url = `${urlData.publicUrl}?t=${Date.now()}`;

      const { error: updateError } = await supabase.from("styles").update({ image_url }).eq("id", id);
      if (updateError) throw updateError;

      queryClient.invalidateQueries({ queryKey: ["style", id] });
      queryClient.invalidateQueries({ queryKey: ["styles"] });
      toast.success("Photo uploaded");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setUploading(false);
    }
  };

  const set = (field: string, value: any) => setForm((prev) => ({ ...prev, [field]: value }));

  if (isLoading) {
    return (
      <AppLayout>
        <div className="text-center py-12 text-muted-foreground">Loading style...</div>
      </AppLayout>
    );
  }

  if (!style) {
    return (
      <AppLayout>
        <div className="text-center py-12 text-muted-foreground">Style not found</div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-4xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/catalog")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="font-display text-2xl sm:text-3xl font-bold text-foreground">
                {merged.style_code} — {merged.name}
              </h1>
              <p className="text-muted-foreground text-sm mt-0.5">Edit style details & factory specs</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="destructive"
              size="sm"
              onClick={() => {
                if (confirm("Deactivate this style?")) deleteStyle.mutate();
              }}
            >
              <Trash2 className="h-4 w-4 mr-1" /> Deactivate
            </Button>
            <Button
              size="sm"
              onClick={() => updateStyle.mutate()}
              disabled={updateStyle.isPending || !Object.keys(form).length}
              className="bg-accent text-accent-foreground hover:bg-accent/90"
            >
              <Save className="h-4 w-4 mr-1" /> Save
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Photo */}
          <Card className="md:col-span-1">
            <CardHeader>
              <CardTitle className="font-display text-lg">Photo</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div
                className="aspect-square rounded-lg bg-secondary flex items-center justify-center overflow-hidden border border-border relative group cursor-pointer"
                onClick={() => merged.image_url && setLightboxOpen(true)}
              >
                {merged.image_url ? (
                  <>
                    <img src={merged.image_url} alt={merged.name} className="w-full h-full object-contain p-2" />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100">
                      <ZoomIn className="h-8 w-8 text-white drop-shadow-lg" />
                    </div>
                  </>
                ) : (
                  <Gem className="h-16 w-16 text-muted-foreground/20" />
                )}
              </div>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleUpload} />
              <Button
                variant="outline"
                className="w-full"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
              >
                {uploading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
                {uploading ? "Uploading..." : "Upload Photo"}
              </Button>
            </CardContent>
          </Card>

          {/* Details */}
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle className="font-display text-lg">Style Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Style Code</Label>
                  <Input value={merged.style_code || ""} onChange={(e) => set("style_code", e.target.value)} />
                </div>
                <div>
                  <Label>Name</Label>
                  <Input value={merged.name || ""} onChange={(e) => set("name", e.target.value)} />
                </div>
              </div>
              <div>
                <Label>Description (for clients)</Label>
                <Textarea
                  value={merged.description || ""}
                  onChange={(e) => set("description", e.target.value)}
                  rows={2}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Category</Label>
                  <Input value={merged.category || ""} onChange={(e) => set("category", e.target.value)} placeholder="e.g. Loafer, Oxford" />
                </div>
                <div>
                  <Label>Season</Label>
                  <Input value={merged.season || ""} onChange={(e) => set("season", e.target.value)} placeholder="e.g. SS 2026" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Wholesale Price</Label>
                  <Input type="number" step="0.01" value={merged.wholesale_price ?? ""} onChange={(e) => set("wholesale_price", Number(e.target.value) || null)} />
                </div>
                <div>
                  <Label>Retail Price</Label>
                  <Input type="number" step="0.01" value={merged.retail_price ?? ""} onChange={(e) => set("retail_price", Number(e.target.value) || null)} />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Factory Specs */}
        <Card>
          <CardHeader>
            <CardTitle className="font-display text-lg">Factory Specifications</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <Label>Last #</Label>
                <Input value={merged.last_number || ""} onChange={(e) => set("last_number", e.target.value)} placeholder="e.g. 290, 614" />
              </div>
              <div>
                <Label>Leather Description</Label>
                <Input value={merged.leather_description || ""} onChange={(e) => set("leather_description", e.target.value)} placeholder="e.g. Boxcalf Negro" />
              </div>
              <div>
                <Label>Sole Type</Label>
                <Input value={merged.sole_type || ""} onChange={(e) => set("sole_type", e.target.value)} placeholder="e.g. Thin, Thick" />
              </div>
              <div>
                <Label>Materials</Label>
                <Input value={merged.materials || ""} onChange={(e) => set("materials", e.target.value)} placeholder="e.g. Full Leather" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Factory Name</Label>
                <Input value={merged.factory_name || ""} onChange={(e) => set("factory_name", e.target.value)} />
              </div>
              <div>
                <Label>Factory Description</Label>
                <Input value={merged.factory_description || ""} onChange={(e) => set("factory_description", e.target.value)} />
              </div>
            </div>
          </CardContent>
        </Card>
        {merged.image_url && (
          <ImageLightbox
            open={lightboxOpen}
            onOpenChange={setLightboxOpen}
            src={merged.image_url}
            alt={merged.name}
          />
        )}
      </div>
    </AppLayout>
  );
}
