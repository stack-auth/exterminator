"use client";

import { StackHandler } from "@stackframe/stack";
import { stackClientApp } from "@/lib/stack-client";

export default function Handler(props: object) {
  return <StackHandler fullPage app={stackClientApp} {...props} />;
}
