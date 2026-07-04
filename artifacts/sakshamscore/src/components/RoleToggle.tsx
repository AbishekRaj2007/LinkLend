import { Tabs, TabsList, TabsTrigger } from "./ui/tabs";

export type AuthRole = "lender" | "borrower";

export default function RoleToggle({
  value,
  onChange,
}: {
  value: AuthRole;
  onChange: (role: AuthRole) => void;
}) {
  return (
    <Tabs
      value={value}
      onValueChange={(v) => onChange(v as AuthRole)}
      className="mb-6"
    >
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="lender">Lender</TabsTrigger>
        <TabsTrigger value="borrower">Borrower</TabsTrigger>
      </TabsList>
    </Tabs>
  );
}
