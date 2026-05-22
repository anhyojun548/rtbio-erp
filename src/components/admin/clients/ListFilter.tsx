"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { FilterBar, FilterField } from "@/components/shared/FilterBar";
import { SearchInput, Select } from "@/components/shared/formElements";
import { Button } from "@/components/shared/Button";

const TYPES = [
  { v: "ALL",      label: "전체" },
  { v: "AGENCY",   label: "대리점" },
  { v: "HOSPITAL", label: "병원" },
  { v: "PHARMACY", label: "약국" },
  { v: "OTHER",    label: "기타" },
];

const ACTIVES = [
  { v: "ALL",      label: "전체" },
  { v: "ACTIVE",   label: "활성" },
  { v: "INACTIVE", label: "비활성" },
];

export function ClientListFilter({
  defaultValues,
}: {
  defaultValues: { q: string; type: string; active: string };
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [q, setQ] = useState(defaultValues.q);
  const [type, setType] = useState(defaultValues.type);
  const [active, setActive] = useState(defaultValues.active);
  const [isPending, start] = useTransition();

  function apply(overrides: Partial<{ q: string; type: string; active: string }> = {}) {
    const next = new URLSearchParams(params.toString());
    const nq = overrides.q ?? q;
    const nt = overrides.type ?? type;
    const na = overrides.active ?? active;
    if (nq.trim()) next.set("q", nq.trim()); else next.delete("q");
    if (nt && nt !== "ALL") next.set("type", nt); else next.delete("type");
    if (na && na !== "ALL") next.set("active", na); else next.delete("active");
    start(() => router.push(`/admin/clients?${next.toString()}`));
  }

  return (
    <FilterBar>
      <FilterField label="검색" minWidth={240}>
        <SearchInput
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && apply()}
          placeholder="코드·업체명·대표자·연락처"
        />
      </FilterField>
      <FilterField label="유형">
        <Select
          value={type}
          onChange={(e) => {
            setType(e.target.value);
            apply({ type: e.target.value });
          }}
        >
          {TYPES.map((t) => (
            <option key={t.v} value={t.v}>{t.label}</option>
          ))}
        </Select>
      </FilterField>
      <FilterField label="상태">
        <Select
          value={active}
          onChange={(e) => {
            setActive(e.target.value);
            apply({ active: e.target.value });
          }}
        >
          {ACTIVES.map((a) => (
            <option key={a.v} value={a.v}>{a.label}</option>
          ))}
        </Select>
      </FilterField>
      <Button onClick={() => apply()} disabled={isPending}>
        {isPending ? "검색 중…" : "검색"}
      </Button>
    </FilterBar>
  );
}
