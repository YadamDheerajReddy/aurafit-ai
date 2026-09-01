import { Camera } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { QuickLookupTab } from "@/features/logging/QuickLookupTab";

export function LogMealPage({ onLogged }: { onLogged: () => void }) {
  return (
    <div className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 px-8 py-8">
      <div>
        <h1 className="font-display text-2xl font-bold text-foreground">Log Meal</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Quick Lookup searches the local USDA reference set — no network,
          instant results.
        </p>
      </div>

      <Tabs defaultValue="quick-lookup">
        <TabsList className="w-full">
          <TabsTrigger value="vision" className="gap-1.5">
            <Camera className="size-4" />
            Vision
          </TabsTrigger>
          <TabsTrigger value="quick-lookup">Quick Lookup</TabsTrigger>
        </TabsList>

        <TabsContent value="vision">
          <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border py-16 text-center">
            <Camera className="size-8 text-muted-foreground" />
            <div>
              <p className="font-display text-base font-semibold text-foreground">
                Photo-based logging arrives in Phase 3
              </p>
              <p className="mt-1 max-w-xs text-sm text-muted-foreground">
                Local vision AI (llama3.2-vision) will estimate a full plate
                from one photo. Use Quick Lookup for now.
              </p>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="quick-lookup">
          <QuickLookupTab onLogged={onLogged} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
