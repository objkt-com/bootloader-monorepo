import type { ParamDefinition } from "@/types/bootloader";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface ParameterFormProps {
  schema: ParamDefinition[];
  values: Record<string, unknown>;
  onChange: (id: string, value: unknown) => void;
}

export function ParameterForm({
  schema,
  values,
  onChange,
}: ParameterFormProps) {
  return (
    <div className="space-y-4">
      {schema.map((param) => (
        <ParameterControl
          key={param.id}
          param={param}
          value={values[param.id]}
          onChange={(value) => onChange(param.id, value)}
        />
      ))}
    </div>
  );
}

interface ParameterControlProps {
  param: ParamDefinition;
  value: unknown;
  onChange: (value: unknown) => void;
}

function ParameterControl({ param, value, onChange }: ParameterControlProps) {
  const label = param.title || param.id;

  // Boolean
  if (param.type === "boolean") {
    const checked = typeof value === "boolean" ? value : Boolean(param.default);
    return (
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id={param.id}
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className=""
        />
        <Label htmlFor={param.id}>{label}</Label>
        {param.description && (
          <span className="text-xs text-muted-foreground">
            ({param.description})
          </span>
        )}
      </div>
    );
  }

  // Integer or Number with enum (dropdown)
  if (
    (param.type === "integer" || param.type === "number") &&
    param.enum &&
    param.enum.length > 0
  ) {
    const numValue =
      typeof value === "number" ? value : (param.default as number) ?? 0;
    return (
      <div className="space-y-1">
        <Label htmlFor={param.id}>{label}</Label>
        <Select
          value={String(numValue)}
          onValueChange={(v) => onChange(Number(v))}
        >
          <SelectTrigger id={param.id}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {param.enum.map((opt, i) => (
              <SelectItem key={String(opt)} value={String(opt)}>
                {param.enumLabels?.[i] ?? String(opt)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {param.description && (
          <p className="text-xs text-muted-foreground">{param.description}</p>
        )}
      </div>
    );
  }

  // Integer or Number with slider
  if (
    (param.type === "integer" || param.type === "number") &&
    param.ui?.widget === "slider"
  ) {
    const numValue =
      typeof value === "number" ? value : (param.default as number) ?? 0;
    const min = param.min ?? 0;
    const max = param.max ?? 100;
    const step = param.step ?? (param.type === "integer" ? 1 : 0.01);
    return (
      <div className="space-y-1">
        <div className="flex justify-between">
          <Label htmlFor={param.id}>{label}</Label>
          <span className="text-xs text-muted-foreground">{numValue}</span>
        </div>
        <input
          type="range"
          id={param.id}
          min={min}
          max={max}
          step={step}
          value={numValue}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-full"
        />
        {param.description && (
          <p className="text-xs text-muted-foreground">{param.description}</p>
        )}
      </div>
    );
  }

  // Integer or Number (default input)
  if (param.type === "integer" || param.type === "number") {
    const numValue =
      typeof value === "number" ? value : (param.default as number) ?? 0;
    const step = param.step ?? (param.type === "integer" ? 1 : 0.01);
    return (
      <div className="space-y-1">
        <Label htmlFor={param.id}>{label}</Label>
        <Input
          id={param.id}
          type="number"
          value={numValue}
          min={param.min}
          max={param.max}
          step={step}
          onChange={(e) => onChange(Number(e.target.value))}
        />
        {param.description && (
          <p className="text-xs text-muted-foreground">{param.description}</p>
        )}
      </div>
    );
  }

  // String with enum (dropdown)
  if (param.type === "string" && param.enum && param.enum.length > 0) {
    const strValue =
      typeof value === "string" ? value : (param.default as string) ?? "";
    return (
      <div className="space-y-1">
        <Label htmlFor={param.id}>{label}</Label>
        <Select value={strValue} onValueChange={onChange}>
          <SelectTrigger id={param.id}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {param.enum.map((opt, i) => (
              <SelectItem key={String(opt)} value={String(opt)}>
                {param.enumLabels?.[i] ?? String(opt)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {param.description && (
          <p className="text-xs text-muted-foreground">{param.description}</p>
        )}
      </div>
    );
  }

  // String with color format
  if (
    param.type === "string" &&
    (param.format === "color" || param.ui?.widget === "color")
  ) {
    const colorValue =
      typeof value === "string"
        ? value
        : (param.default as string) ?? "#000000";
    return (
      <div className="space-y-1">
        <Label htmlFor={param.id}>{label}</Label>
        <div className="flex gap-2">
          <input
            type="color"
            id={param.id}
            value={colorValue}
            onChange={(e) => onChange(e.target.value)}
            className="h-9 w-12 border cursor-pointer"
          />
          <Input
            value={colorValue}
            onChange={(e) => onChange(e.target.value)}
            className="font-mono"
          />
        </div>
        {param.description && (
          <p className="text-xs text-muted-foreground">{param.description}</p>
        )}
      </div>
    );
  }

  // String with textarea
  if (
    param.type === "string" &&
    (param.format === "textarea" || param.ui?.widget === "textarea")
  ) {
    const strValue =
      typeof value === "string" ? value : (param.default as string) ?? "";
    return (
      <div className="space-y-1">
        <Label htmlFor={param.id}>{label}</Label>
        <Textarea
          id={param.id}
          value={strValue}
          onChange={(e) => onChange(e.target.value)}
          rows={4}
        />
        {param.description && (
          <p className="text-xs text-muted-foreground">{param.description}</p>
        )}
      </div>
    );
  }

  // String (default)
  if (param.type === "string") {
    const strValue =
      typeof value === "string" ? value : (param.default as string) ?? "";
    return (
      <div className="space-y-1">
        <Label htmlFor={param.id}>{label}</Label>
        <Input
          id={param.id}
          value={strValue}
          onChange={(e) => onChange(e.target.value)}
        />
        {param.description && (
          <p className="text-xs text-muted-foreground">{param.description}</p>
        )}
      </div>
    );
  }

  // Fallback for unsupported types
  return (
    <div className="space-y-1">
      <Label>{label}</Label>
      <p className="text-xs text-muted-foreground">
        Unsupported parameter type: {param.type}
      </p>
    </div>
  );
}
