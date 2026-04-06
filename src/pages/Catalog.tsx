import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Search, Gem, ZoomIn } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { ImageLightbox } from "@/components/ImageLightbox";

export default function Catalog() {
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [lightbox, setLightbox] = useState<{ src: string; alt: string } | null>(null);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const { data: styles, isLoading } = useQuery({
    queryKey: ["styles", search],
    queryFn: async () => {
      let query = supabase.from("styles").select("*").eq("is_active", true).order("style_code");
      if (search) {
        query = query.or(`style_code.ilike.%${search}%,name.ilike.%${search}%,category.ilike.%${search}%`);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const addStyle = useMutation({
    mutationFn: async (formData: FormData) => {
      const style = {
        style_code: formData.get("style_code") as string,
        name: formData.get("name") as string,
        description: formData.get("description") as string,
        last_number: formData.get("last_number") as string || null,
        leather_description: formData.get("leather_description") as string || null,
        sole_type: formData.get("sole_type") as string || null,
        category: formData.get("category") as string,
        wholesale_price: Number(formData.get("wholesale_price")) || null,
        retail_price: Number(formData.get("retail_price")) || null,
        materials: formData.get("materials") as string,
        season: formData.get("season") as string,
        image_url: formData.get("image_url") as string || null,
      };
      const { error } = await supabase.from("styles").insert(style);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["styles"] });
      setDialogOpen(false);
      toast.success("Style added successfully");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-bold text-foreground">Style Catalog</h1>
            <p className="text-muted-foreground mt-1">{styles?.length ?? 0} styles in collection</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-accent text-accent-foreground hover:bg-gold-dark">
                <Plus className="h-4 w-4 mr-2" /> Add Style
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="font-display">Add New Style</DialogTitle>
              </DialogHeader>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  addStyle.mutate(new FormData(e.currentTarget));
                }}
                className="space-y-4"
              >
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="style_code">Style Code *</Label>
                    <Input id="style_code" name="style_code" required placeholder="e.g. NK-2024-A1" />
                  </div>
                  <div>
                    <Label htmlFor="name">Name *</Label>
                    <Input id="name" name="name" required placeholder="e.g. Diamond Pendant" />
                  </div>
                </div>
                <div>
                  <Label htmlFor="description">Description</Label>
                  <Textarea id="description" name="description" placeholder="Style description for clients" />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="last_number">Last #</Label>
                    <Input id="last_number" name="last_number" placeholder="e.g. 290, 614, Belga" />
                  </div>
                  <div>
                    <Label htmlFor="leather_description">Leather</Label>
                    <Input id="leather_description" name="leather_description" placeholder="e.g. Boxcalf Negro" />
                  </div>
                  <div>
                    <Label htmlFor="sole_type">Sole Type</Label>
                    <Input id="sole_type" name="sole_type" placeholder="e.g. Thin, Thick" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="category">Category</Label>
                    <Input id="category" name="category" placeholder="e.g. Loafer, Oxford" />
                  </div>
                  <div>
                    <Label htmlFor="materials">Materials</Label>
                    <Input id="materials" name="materials" placeholder="e.g. Leather" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="wholesale_price">Wholesale Price</Label>
                    <Input id="wholesale_price" name="wholesale_price" type="number" step="0.01" placeholder="0.00" />
                  </div>
                  <div>
                    <Label htmlFor="retail_price">Retail Price</Label>
                    <Input id="retail_price" name="retail_price" type="number" step="0.01" placeholder="0.00" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="season">Season</Label>
                    <Input id="season" name="season" placeholder="e.g. Spring 2026" />
                  </div>
                  <div>
                    <Label htmlFor="image_url">Image URL</Label>
                    <Input id="image_url" name="image_url" placeholder="https://..." />
                  </div>
                </div>
                <Button type="submit" className="w-full bg-primary text-primary-foreground" disabled={addStyle.isPending}>
                  {addStyle.isPending ? "Adding..." : "Add Style"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search styles by code, name, or category..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>

        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground">Loading catalog...</div>
        ) : !styles?.length ? (
          <div className="text-center py-20">
            <Gem className="h-16 w-16 mx-auto text-accent/40 mb-4" />
            <h3 className="font-display text-xl text-foreground mb-2">No styles yet</h3>
            <p className="text-muted-foreground">Add your first style to get started</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {styles.map((style) => (
              <Card key={style.id} className="overflow-hidden hover:shadow-lg transition-shadow border-border group cursor-pointer" onClick={() => navigate(`/catalog/${style.id}`)}>
                <div className="aspect-square bg-secondary flex items-center justify-center overflow-hidden relative group/img">
                  {style.image_url ? (
                    <>
                      <img src={style.image_url} alt={style.name} className="w-full h-full object-contain p-2" />
                      <button
                        className="absolute inset-0 bg-black/0 group-hover/img:bg-black/20 transition-all flex items-center justify-center opacity-0 group-hover/img:opacity-100"
                        onClick={(e) => { e.stopPropagation(); setLightbox({ src: style.image_url!, alt: style.name }); }}
                      >
                        <ZoomIn className="h-8 w-8 text-white drop-shadow-lg" />
                      </button>
                    </>
                  ) : (
                    <Gem className="h-12 w-12 text-muted-foreground/30" />
                  )}
                </div>
                <CardContent className="p-3">
                  <p className="text-sm font-mono text-accent font-semibold text-center">{style.style_code}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {lightbox && (
          <ImageLightbox
            open={!!lightbox}
            onOpenChange={(open) => { if (!open) setLightbox(null); }}
            src={lightbox.src}
            alt={lightbox.alt}
          />
        )}
      </div>
    </AppLayout>
  );
}
