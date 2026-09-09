"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

const videos = [
  "/stir-fry.mp4",
  "/bell-peppers.mp4",
];

export default function Home() {
  const [currentVideo, setCurrentVideo] = useState(0);
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);

  useEffect(() => {
    videoRefs.current[0]?.play().catch(() => {});
  }, []);

  function playNextVideo() {
    const nextVideo = (currentVideo + 1) % videos.length;

    const next = videoRefs.current[nextVideo];

    if (next) {
      next.currentTime = 0;
      next.play().catch(() => {});
    }

    setCurrentVideo(nextVideo);
  }

  return (
    <main className="min-h-screen bg-stone-50 text-gray-900">

      {/* Header */}
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-8 py-5">
          <h1 className="text-4xl font-bold text-green-700">
            PantryCart
          </h1>

          <div className="flex items-center gap-4">
            <Link
              href="/login"
              className="font-medium text-gray-700 hover:text-green-700"
            >
              Log In
            </Link>

            <Link
              href="/signup"
              className="rounded-lg bg-green-700 px-5 py-2.5 font-semibold text-white hover:bg-green-800"
            >
              Get Started
            </Link>
          </div>
        </div>
      </header>


      {/* Video Hero */}
      <section className="relative flex min-h-[620px] items-center justify-center overflow-hidden">

      {/* Background Videos */}
      <div className="absolute inset-0 bg-black">
        {videos.map((video, index) => (
          <video
            key={video}
            ref={(element) => {
              videoRefs.current[index] = element;
            }}
            muted
            playsInline
            preload="auto"
            onEnded={index === currentVideo ? playNextVideo : undefined}
            className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-1000 ${
              index === currentVideo ? "opacity-100" : "opacity-0"
            }`}
          >
            <source src={video} type="video/mp4" />
          </video>
        ))}
      </div>

        {/* Dark overlay */}
        <div className="absolute inset-0 bg-black/50" />

        {/* Hero Content */}
        <div className="relative z-10 mx-auto max-w-4xl px-8 text-center text-white">
          <p className="mb-4 text-lg font-semibold">
            Smarter cooking starts with what you already have.
          </p>

          <h2 className="text-5xl font-bold leading-tight md:text-6xl">
            Discover meals.
            <br />
            Use your pantry.
            <br />
            <span className="text-green-300">
              Shop only for what you need.
            </span>
          </h2>

          <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-gray-200">
            PantryCart helps you discover recipes, create meals from the
            ingredients you already have, and build shopping lists for
            anything you're missing.
          </p>

          <Link
            href="/signup"
            className="mt-8 inline-block rounded-lg bg-green-700 px-7 py-3.5 font-semibold text-white transition hover:bg-green-800"
          >
            Get Started
          </Link>
        </div>
      </section>


      {/* Feature Card */}
      <section className="mx-auto max-w-6xl px-8 py-20">
        <div className="relative overflow-hidden rounded-3xl border bg-white shadow-sm">

          {/* Faded Food Background */}
          <div
            className="absolute inset-0 bg-center bg-no-repeat opacity-40"
            style={{
              backgroundImage:
                "url('/food-spread.avif')",
              backgroundSize: "100%",
            }}
          />

          {/* Slight white overlay */}
          <div className="absolute inset-0 bg-gray-100/70" />

          {/* Card Content */}
          <div className="relative z-10 px-8 py-16 md:px-14">

            <div className="mb-12 text-center">
              <p className="font-extrabold text-green-700">
                Everything you need to make your next meal
              </p>

              <h2 className="mt-2 text-3xl font-extrabold">
                From pantry to plate
              </h2> 
            </div>


            {/* Three Features */}
            <div className="grid gap-10 md:grid-cols-3">

              {/* Recipe Discovery */}
              <div>

                <h3 className="text-xl font-extrabold">
                  Recipe Discovery
                </h3>

                <p className="mt-3 leading-7 text-black">
                  Browse recipes and find something new for your next meal.
                </p>
              </div>


              {/* Pantry Generation */}
              <div>

                <h3 className="text-xl font-extrabold">
                  Cook With What You Have
                </h3>

                <p className="mt-3 leading-7 text-black">
                  Turn ingredients already in your kitchen into recipe ideas.
                </p>
              </div>


              {/* Shopping Lists */}
              <div>

                <h3 className="text-xl font-extrabold">
                  Smart Shopping Lists
                </h3>

                <p className="mt-3 leading-7 text-black">
                  Find what you're missing and create a list for your recipe.
                </p>
              </div>

            </div>


            {/* CTA */}
            <div className="mt-14 text-center">
              <Link
                href="/signup"
                className="inline-block rounded-lg bg-green-700 px-7 py-3.5 font-semibold text-white transition hover:bg-green-800"
              >
                Start Cooking
              </Link>
            </div>

          </div>
        </div>
      </section>


      {/* Footer */}
      <footer className="border-t bg-white">
        <div className="mx-auto max-w-6xl px-8 py-6 text-sm text-gray-500">
          © 2026 PantryCart
        </div>
      </footer>
    </main>
  );
}