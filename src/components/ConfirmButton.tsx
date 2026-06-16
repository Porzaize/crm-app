"use client";

import type { ButtonHTMLAttributes } from "react";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  /** ข้อความที่แสดงในกล่องยืนยันก่อนทำงาน */
  message: string;
};

/**
 * ปุ่ม submit ที่ถามยืนยันก่อนส่งฟอร์ม (ใช้กับงานที่ทำลาย/เปลี่ยนข้อมูลสำคัญ)
 * ใช้แทน <button type="submit"> ในฟอร์มที่ยิง server action ได้ตรงๆ
 */
export default function ConfirmButton({ message, children, type, ...rest }: Props) {
  return (
    <button
      type={type ?? "submit"}
      onClick={(e) => {
        if (!window.confirm(message)) e.preventDefault();
      }}
      {...rest}
    >
      {children}
    </button>
  );
}
