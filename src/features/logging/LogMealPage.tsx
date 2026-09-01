import { Camera, Sparkles } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { QuickLookupTab } from "@/features/logging/QuickLookupTab";
import { VisionTab } from "@/features/logging/VisionTab";
import { DescribeMealTab } from "@/features/logging/DescribeMealTab";

export function LogMealPage({ onLogged }: { onLogged: () => void }) {
  return (
    <div className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 px-8 py-8">
      <div>
        <h1 className="font-display text-2xl font-bold text-foreground">Log Meal</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Describe or photograph a meal for an AI estimate, or search the
          local USDA reference set directly — either way, nothing leaves this
          device.
        </p>
      </div>

      <Tabs defaultValue="describe">
        <TabsList className="w-full">
          <TabsTrigger value="describe" className="gap-1.5">
            <Sparkles className="size-4" />
            Describe
          </TabsTrigger>
          <TabsTrigger value="vision" className="gap-1.5">
            <Camera className="size-4" />
            Vision
          </TabsTrigger>
          <TabsTrigger value="quick-lookup">Quick Lookup</TabsTrigger>
        </TabsList>

        <TabsContent value="describe">
          <DescribeMealTab onLogged={onLogged} />
        </TabsContent>

        <TabsContent value="vision">
          <VisionTab onLogged={onLogged} />
        </TabsContent>

        <TabsContent value="quick-lookup">
          <QuickLookupTab onLogged={onLogged} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
