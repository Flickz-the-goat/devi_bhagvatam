"use client"
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useEffect, useState } from "react";

interface LastReadType {
  pageId: number,
  shlokaId: string | number,
}

export default function Navbar(){
  const [lastRead, setLastRead] = useState<LastReadType | null>(null)
  useEffect(() => {
    const getSaved = async () => {
      const saved = localStorage.getItem("lastRead")

      if (saved) {
        const lastReadVar = JSON.parse(saved);
        setLastRead(lastReadVar)
      }
      else{
        setLastRead(null)
      }
    }

    getSaved()

 }, [])
  return (
    <nav className="sticky top-0 mx-4 mt-4 max-w-6xl rounded-xl border bg-muted p-2 sm:px-4 xl:mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-2">
        {lastRead && (
          <Button
            className="min-h-11"
            nativeButton={false}
            render={<Link href={`/pages/${lastRead.pageId}#${lastRead.shlokaId}`} />}
          >
            Last read
          </Button>
        )}
        <h1 className="text-xl text-primary">स्वार्थ</h1>
        <Button
          className="min-h-11"
          variant="destructive"
          nativeButton={false}
          render={<Link href="/admin" />}
        >
          Admin
        </Button>
      </div>
    </nav>
  );
}
