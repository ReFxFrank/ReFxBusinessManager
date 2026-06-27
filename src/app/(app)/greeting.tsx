"use client";
import * as React from "react";

/** Time-of-day greeting computed from the user's LOCAL time. */
export function Greeting({ name }: { name: string }) {
  const [word, setWord] = React.useState("Hello");
  React.useEffect(() => {
    const h = new Date().getHours();
    setWord(h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening");
  }, []);
  return (
    <h1 className="text-2xl font-bold tracking-tight">
      {word}, {name} <span className="align-middle">👋</span>
    </h1>
  );
}
