import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Pencil, Check, X, Loader2 } from "lucide-react";
import { useSaved, useRefreshUserData } from "@/hooks/useNutriQueries";
import { api, type SavedProduct } from "@/lib/api";
import { toast } from "sonner";
import { ErrorBanner } from "./ErrorBanner";
import { fmtEur } from "@/lib/format";

export function SavedProductsTable() {
  const { data, isLoading, error } = useSaved();
  const refresh = useRefreshUserData();
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editPrice, setEditPrice] = useState("");
  const [editServing, setEditServing] = useState("");

  const update = useMutation({
    mutationFn: ({ id, price, serving }: { id: number; price: number; serving?: number }) =>
      api.updatePrice(id, {
        estimated_price_eur: price,
        ...(serving ? { serving_size_g: serving } : {}),
      }),
    onSuccess: () => {
      toast.success("Price updated");
      setEditingId(null);
      refresh();
    },
    onError: (e: Error) => toast.error(`Update failed: ${e.message}`),
  });

  function startEdit(p: SavedProduct) {
    setEditingId(p.id);
    setEditPrice(String(p.estimated_price_eur ?? ""));
    setEditServing(String(p.serving_size_g ?? ""));
  }

  return (
    <Card className="rounded-md">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">Saved products</CardTitle>
      </CardHeader>
      <CardContent>
        {error ? <ErrorBanner error={error} /> : null}
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead className="h-9">Name</TableHead>
                <TableHead className="h-9">Brand</TableHead>
                <TableHead className="h-9">Category</TableHead>
                <TableHead className="h-9 text-right">kcal/100g</TableHead>
                <TableHead className="h-9 text-right text-emerald-700">P/100g</TableHead>
                <TableHead className="h-9 text-right">Pack size</TableHead>
                <TableHead className="h-9 text-right">Price</TableHead>
                <TableHead className="h-9 w-[60px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={8} className="py-6 text-center text-xs text-muted-foreground">
                    Loading saved products...
                  </TableCell>
                </TableRow>
              ) : (data?.length ?? 0) === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="py-6 text-center text-xs text-muted-foreground">
                    No saved products yet. Use the food search to save items.
                  </TableCell>
                </TableRow>
              ) : (
                data!.map((p) => {
                  const isEditing = editingId === p.id;
                  return (
                    <TableRow key={p.id} className="text-sm">
                      <TableCell className="font-medium">{p.name}</TableCell>
                      <TableCell className="text-muted-foreground">{p.brand ?? "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{p.category ?? "—"}</TableCell>
                      <TableCell className="text-right">{p.calories_per_100g?.toFixed(0)}</TableCell>
                      <TableCell className="text-right text-emerald-700">
                        {p.protein_per_100g?.toFixed(1)}g
                      </TableCell>
                      <TableCell className="text-right">
                        {isEditing ? (
                          <Input
                            value={editServing}
                            onChange={(e) => setEditServing(e.target.value)}
                            className="ml-auto h-7 w-20 text-right text-xs"
                            type="number"
                          />
                        ) : (
                          `${p.serving_size_g ?? "—"}g`
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {isEditing ? (
                          <Input
                            value={editPrice}
                            onChange={(e) => setEditPrice(e.target.value)}
                            className="ml-auto h-7 w-20 text-right text-xs"
                            type="number"
                            step="0.01"
                          />
                        ) : (
                          <span className="text-orange-600">{fmtEur(p.estimated_price_eur)}</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {isEditing ? (
                          <div className="flex justify-end gap-1">
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7"
                              disabled={update.isPending}
                              onClick={() => {
                                const price = parseFloat(editPrice);
                                const serving = editServing ? parseFloat(editServing) : undefined;
                                if (!isNaN(price)) update.mutate({ id: p.id, price, serving });
                              }}
                            >
                              {update.isPending ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Check className="h-3.5 w-3.5 text-emerald-600" />
                              )}
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7"
                              onClick={() => setEditingId(null)}
                            >
                              <X className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        ) : (
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => startEdit(p)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
