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
    <nav className="sticky top-0 max-w-6xl mx-auto rounded-xl mt-4 border bg-muted p-2 px-4 border-border)">
    <div className="flex justify-between">
    {
      lastRead != null && (
      <Link href={`/pages/${lastRead.pageId}#${lastRead.shlokaId}`}>
        <Button>
        Last read
        </Button>
      </Link>
      )
    }
    <h1 className="text-primary text-xl">स्वार्थ</h1>
   <Link href={"/admin"}>
    <Button
    variant={"destructive"}
    >
      Admin
    </Button>
    </Link>
    </div>
    </nav>
  )
}
