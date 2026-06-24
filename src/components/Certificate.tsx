"use client";

import { useEffect, useRef } from "react";

interface Props {
  name: string;
  topic: string;
  score: number;
  total: number;
}

/**
 * Renders a professional, VidhyaAI-branded certificate on a <canvas>
 * and lets the user download it as a PNG. No external dependency.
 */
export function Certificate({ name, topic, score, total }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const percent = Math.round((score / total) * 100);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const W = 1000;
    const H = 700;
    canvas.width = W;
    canvas.height = H;

    const date = new Date().toLocaleDateString("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });

    // Background gradient
    const bg = ctx.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, "#0b0d18");
    bg.addColorStop(0.5, "#141033");
    bg.addColorStop(1, "#0d1a1f");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // Soft glow blobs
    const glow = (x: number, y: number, r: number, color: string) => {
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, color);
      g.addColorStop(1, "transparent");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    };
    glow(120, 80, 320, "rgba(124,140,255,0.25)");
    glow(900, 640, 360, "rgba(56,224,176,0.18)");

    // Outer + inner borders
    ctx.strokeStyle = "rgba(255,255,255,0.15)";
    ctx.lineWidth = 2;
    ctx.strokeRect(28, 28, W - 56, H - 56);

    const accent = ctx.createLinearGradient(40, 0, W - 40, 0);
    accent.addColorStop(0, "#a78bfa");
    accent.addColorStop(0.5, "#7c8cff");
    accent.addColorStop(1, "#38e0b0");
    ctx.strokeStyle = accent;
    ctx.lineWidth = 4;
    ctx.strokeRect(44, 44, W - 88, H - 88);

    const center = W / 2;
    ctx.textAlign = "center";

    // Brand
    ctx.fillStyle = "#a78bfa";
    ctx.font = "bold 30px Georgia, serif";
    ctx.fillText("✦ VidhyaAI", center, 110);
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.font = "14px Arial, sans-serif";
    ctx.fillText("AI STUDY COMPANION", center, 134);

    // Title
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 46px Georgia, serif";
    ctx.fillText("Certificate of Achievement", center, 220);

    // Divider
    ctx.strokeStyle = "rgba(124,140,255,0.6)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(center - 90, 244);
    ctx.lineTo(center + 90, 244);
    ctx.stroke();

    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.font = "18px Arial, sans-serif";
    ctx.fillText("This certificate is proudly presented to", center, 296);

    // Name
    ctx.fillStyle = "#ffffff";
    ctx.font = "italic bold 52px Georgia, serif";
    ctx.fillText(name || "Star Learner", center, 360);

    // Name underline
    const nameWidth = Math.min(ctx.measureText(name || "Star Learner").width + 60, 760);
    ctx.strokeStyle = "rgba(56,224,176,0.5)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(center - nameWidth / 2, 378);
    ctx.lineTo(center + nameWidth / 2, 378);
    ctx.stroke();

    // Body
    ctx.fillStyle = "rgba(255,255,255,0.75)";
    ctx.font = "18px Arial, sans-serif";
    ctx.fillText("for successfully completing the mock test on", center, 422);

    ctx.fillStyle = "#7c8cff";
    ctx.font = "bold 26px Georgia, serif";
    const topicText = topic.length > 46 ? topic.slice(0, 46) + "…" : topic;
    ctx.fillText(`“${topicText}”`, center, 460);

    // Score badge
    ctx.fillStyle = "#38e0b0";
    ctx.font = "bold 40px Georgia, serif";
    ctx.fillText(`${percent}%`, center, 520);
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.font = "16px Arial, sans-serif";
    ctx.fillText(`Scored ${score} out of ${total}`, center, 546);

    // Footer: date (left) + signature (right)
    ctx.textAlign = "left";
    ctx.fillStyle = "rgba(255,255,255,0.55)";
    ctx.font = "15px Arial, sans-serif";
    ctx.fillText(date, 90, 620);
    ctx.strokeStyle = "rgba(255,255,255,0.3)";
    ctx.beginPath();
    ctx.moveTo(90, 600);
    ctx.lineTo(250, 600);
    ctx.stroke();
    ctx.fillText("Date", 90, 642);

    ctx.textAlign = "right";
    ctx.fillStyle = "#a78bfa";
    ctx.font = "italic 22px Georgia, serif";
    ctx.fillText("VidhyaAI", W - 90, 614);
    ctx.strokeStyle = "rgba(255,255,255,0.3)";
    ctx.beginPath();
    ctx.moveTo(W - 250, 600);
    ctx.lineTo(W - 90, 600);
    ctx.stroke();
    ctx.fillStyle = "rgba(255,255,255,0.55)";
    ctx.font = "15px Arial, sans-serif";
    ctx.fillText("Authorised by VidhyaAI", W - 90, 642);

    // Seal
    ctx.textAlign = "center";
    ctx.beginPath();
    ctx.arc(center, 606, 36, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(124,140,255,0.15)";
    ctx.fill();
    ctx.strokeStyle = accent;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = "#ffd76a";
    ctx.font = "26px Arial";
    ctx.fillText("★", center, 616);
  }, [name, topic, score, total, percent]);

  function download() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const a = document.createElement("a");
    a.href = canvas.toDataURL("image/png");
    a.download = `VidhyaAI-Certificate-${(name || "learner").replace(/\s+/g, "-")}.png`;
    a.click();
  }

  return (
    <div className="space-y-3">
      <canvas
        ref={canvasRef}
        className="w-full rounded-xl border border-border shadow-2xl shadow-black/40"
      />
      <button
        onClick={download}
        className="btn-glow inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-medium text-white"
      >
        📥 Download Certificate
      </button>
    </div>
  );
}
