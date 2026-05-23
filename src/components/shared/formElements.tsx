/**
 * formElements — prototype 디자인의 공통 폼 요소
 *
 * Input, Select, Textarea, Label
 * className 통일로 어디서나 같은 모양.
 */

import type {
  InputHTMLAttributes,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
  LabelHTMLAttributes,
  ReactNode,
} from "react";

const INPUT_CLASS = `
  h-9 px-3 py-1.5 text-caption
  bg-surface text-ink
  border border-border rounded-xs
  focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20
  disabled:bg-canvas disabled:text-ink-muted disabled:cursor-not-allowed
  transition w-full
`;

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  const { className = "", ...rest } = props;
  return <input className={`${INPUT_CLASS} ${className}`} {...rest} />;
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement> & { children: ReactNode }) {
  const { className = "", children, ...rest } = props;
  return (
    <select className={`${INPUT_CLASS} pr-8 ${className}`} {...rest}> {children}
    </select> );
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const { className = "", ...rest } = props;
  return (
    <textarea
      className={`${INPUT_CLASS} h-auto py-2 ${className}`}
      {...rest}
    /> );
}

export function Label({
  children,
  required,
  ...rest
}: LabelHTMLAttributes<HTMLLabelElement> & { required?: boolean }) {
  return (
    <label className="text-caption font-semibold text-ink-secondary block mb-1" {...rest}> {children}
      {required && <span className="text-danger ml-0.5">*</span>}
    </label> );
}

/** 검색 input — placeholder, 좌측  아이콘 */
export function SearchInput(props: InputHTMLAttributes<HTMLInputElement>) {
  const { className = "", ...rest } = props;
  return (
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted text-sm">
        
      </span>
      <Input
        type="search"
        className={`pl-9 ${className}`}
        {...rest}
      />
    </div> );
}
