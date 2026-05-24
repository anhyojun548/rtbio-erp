"use client";

/**
 * NoticeBoard — 4개 포털 공통 공지 목록 + 작성 모달
 *
 * 사용:
 *   <NoticeBoard
 *     authorTeam="영업팀"
 *     initialNotices={notices}
 *     clients={clients}
 *   /> */

import { useState, useTransition } from "react";
import {
  NOTICE_TARGETS,
  NOTICE_TARGET_LABEL,
  NOTICE_PRIORITIES,
  NOTICE_AUTHOR_META,
  type NoticeAuthorTeam,
  type NoticeTargetType,
  type NoticePriorityType,
} from "@/lib/validators/notice";
import { Button } from "@/components/shared/Button";
import { PageHeader } from "@/components/shared/PageHeader";
import { Modal } from "@/components/shared/Modal";
import { Input, Select, Textarea, Label } from "@/components/shared/formElements";
import { toast } from "@/components/shared/Toast";
import { createNotice, deleteNotice } from "@/lib/actions/notice";

export interface NoticeBoardItem {
  id: string;
  title: string;
  body: string;
  target: NoticeTargetType;
  priority: NoticePriorityType;
  pinned: boolean;
  createdBy: string;
  createdByTeam: string;
  createdAt: string;        // ISO
  expiresAt: string | null; // ISO
  recipients: { client: { id: string; name: string; type: string } }[];
  _count: { readLogs: number; recipients: number };
}

export interface ClientOption {
  id: string;
  code: string;
  name: string;
  type: string; // ClientType
}

interface Props {
  authorTeam: NoticeAuthorTeam;
  initialNotices: NoticeBoardItem[];
  clients: ClientOption[];
  /** 전체 거래처 수 (ALL 발송 시 대상 카운트) */
  totalClients: { all: number; dealer: number; hospital: number };
}

export function NoticeBoard({ authorTeam, initialNotices, clients, totalClients }: Props) {
  const [composing, setComposing] = useState(false);
  const [pending, start] = useTransition();
  const am = NOTICE_AUTHOR_META[authorTeam];

  function onDelete(id: string) {
    if (!confirm("공지를 삭제하시겠습니까?")) return;
    start(async () => {
      const res = await deleteNotice(id);
      if (res.ok) {
        toast.success("공지가 삭제되었습니다");
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={`공지사항 — ${authorTeam}`}
        subtitle="거래처에 발송하는 공지사항을 작성·관리합니다. 발송 즉시 거래처 포털에 표시됩니다."
        actions={
          <Button onClick={() => setComposing(true)} variant="primary"> + 공지 작성
          </Button> }
      /> {/* 목록 */}
      {initialNotices.length === 0 ? (
        <div className="bg-surface border border-border rounded p-12 text-center text-ink-muted"> 작성된 공지가 없습니다.
        </div> ) : (
        <ul className="space-y-3"> {initialNotices.map((n) => {
            const meta = NOTICE_AUTHOR_META[(n.createdByTeam as NoticeAuthorTeam)] ?? am;
            const targetCount =
              n.target === "ALL"      ? totalClients.all :
              n.target === "DEALER"   ? totalClients.dealer :
              n.target === "HOSPITAL" ? totalClients.hospital :
              n._count.recipients;
            return (
              <li
                key={n.id}
                className="bg-surface border border-border rounded p-4 hover:shadow-sm transition"
                style={n.pinned ? { borderLeftWidth: 3, borderLeftColor: "#D32F2F" } : {}}
              >
                <div className="flex items-start justify-between gap-3 flex-wrap mb-2">
                  <div className="flex items-center gap-2 flex-wrap"> {n.pinned && <span className="text-danger"></span>}
                    <strong className="text-h3">{n.title}</strong> {n.priority === "HIGH" && (
                      <span className="px-2 py-0.5 rounded-full text-tiny font-semibold bg-danger-light text-danger">긴급</span> )}
                    <span className="px-2 py-0.5 rounded-full text-tiny font-semibold" style={{ background: "var(--accent-light)", color: "var(--accent-dark)" }}> {NOTICE_TARGET_LABEL[n.target]}
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-tiny font-semibold" style={{ background: meta.bg, color: meta.color }}> {n.createdByTeam}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => onDelete(n.id)} disabled={pending}> 삭제
                    </Button>
                  </div>
                </div>
                <p className="text-caption text-ink mb-2 whitespace-pre-wrap">{n.body}</p>
                <div className="flex items-center justify-between text-tiny text-ink-muted">
                  <span> {fmtDateTime(n.createdAt)}
                    {n.expiresAt && ` · 만료: ${fmtDateTime(n.expiresAt)}`}
                  </span>
                  <span> 읽음 <strong className="text-ink">{n._count.readLogs}</strong> / 대상 <strong className="text-ink">{targetCount}</strong>
                  </span>
                </div>
              </li> );
          })}
        </ul> )}

      {/* 작성 모달 */}
      {composing && (
        <ComposeModal
          authorTeam={authorTeam}
          clients={clients}
          onClose={() => setComposing(false)}
        /> )}
    </div> );
}

// ── 작성 모달 ──────────────────────────────────────────
function ComposeModal({
  authorTeam,
  clients,
  onClose,
}: {
  authorTeam: NoticeAuthorTeam;
  clients: ClientOption[];
  onClose: () => void;
}) {
  const am = NOTICE_AUTHOR_META[authorTeam];
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [target, setTarget] = useState<NoticeTargetType>("ALL");
  const [priority, setPriority] = useState<NoticePriorityType>("NORMAL");
  const [pinned, setPinned] = useState(false);
  const [expiresAt, setExpiresAt] = useState("");
  const [targetClientIds, setTargetClientIds] = useState<string[]>([]);
  const [pending, start] = useTransition();

  function onSubmit() {
    if (!title.trim()) {
      toast.error("제목은 필수입니다");
      return;
    }
    if (!body.trim()) {
      toast.error("본문은 필수입니다");
      return;
    }
    if (target === "SPECIFIC" && targetClientIds.length === 0) {
      toast.error("특정 거래처를 1개 이상 선택해주세요");
      return;
    }

    start(async () => {
      const res = await createNotice(authorTeam, {
        title: title.trim(),
        body:  body.trim(),
        target,
        priority,
        pinned,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        targetClientIds: target === "SPECIFIC" ? targetClientIds : [],
      });
      if (res.ok) {
        toast.success("공지가 발송되었습니다");
        onClose();
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <Modal
      open
      title={`공지사항 작성 — ${authorTeam}`}
      onClose={onClose}
      onConfirm={onSubmit}
      confirmText={pending ? "발송 중..." : "발송"}
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label required>제목</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="공지 제목" />
          </div>
          <div>
            <Label>긴급도</Label>
            <Select value={priority} onChange={(e) => setPriority(e.target.value as NoticePriorityType)}> {NOTICE_PRIORITIES.map((p) => (
                <option key={p} value={p}>{p === "HIGH" ? " 긴급" : "일반"}</option> ))}
            </Select>
          </div>
        </div>

        <div>
          <Label required>본문</Label>
          <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={5} placeholder="공지 내용..." />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>발송 대상</Label>
            <Select value={target} onChange={(e) => setTarget(e.target.value as NoticeTargetType)}> {NOTICE_TARGETS.map((t) => (
                <option key={t} value={t}>{NOTICE_TARGET_LABEL[t]}</option> ))}
            </Select>
          </div>
          <div>
            <Label>만료일 (선택)</Label>
            <Input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
          </div>
        </div> {target === "SPECIFIC" && (
          <div>
            <Label required>대상 거래처 선택 (다중)</Label>
            <select
              multiple
              value={targetClientIds}
              onChange={(e) => setTargetClientIds(Array.from(e.target.selectedOptions).map((o) => o.value))}
              className="w-full border border-border rounded-xs px-3 py-2 text-caption h-32"
            > {clients.map((c) => (
                <option key={c.id} value={c.id}> {c.name} ({c.type})
                </option> ))}
            </select>
            <p className="text-tiny text-ink-muted mt-1">선택된 거래처: {targetClientIds.length}개</p>
          </div> )}

        <div>
          <label className="flex items-center gap-2 text-caption cursor-pointer">
            <input type="checkbox" checked={pinned} onChange={(e) => setPinned(e.target.checked)} /> 상단 고정 ( 표시)
          </label>
        </div>

        <div className="rounded-xs px-3 py-2 text-caption flex items-center gap-2" style={{ background: am.bg, color: am.color }}>
          <span>작성자: <strong>{authorTeam}</strong> (자동 설정)</span>
        </div>
      </div>
    </Modal> );
}

function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("ko-KR", { dateStyle: "short", timeStyle: "short" });
}
