/**
 * Shows the WHOLE photo at its own ratio — never cropped. Any space around it is filled with a soft,
 * blurred copy of the same photo (or a plain colour), so frames of any shape still look finished.
 */
export default function FitImage({ src, alt = "", className = "", fill = "blur", imgClassName = "", eager }: {
  src: string; alt?: string; className?: string; fill?: "blur" | "plain" | "none"; imgClassName?: string; eager?: boolean;
}) {
  const video = /\.(mp4|webm)(\?|$)/i.test(src);
  return (
    <div className={`${/(^|\s)(absolute|fixed)(\s|$)/.test(className) ? "" : "relative"} overflow-hidden ${fill === "plain" ? "bg-white" : ""} ${className}`}>
      {fill === "blur" && !video && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" aria-hidden="true" className="absolute inset-0 h-full w-full scale-110 object-cover opacity-70 blur-2xl" />
      )}
      {video
        ? <video src={src} className={`relative h-full w-full object-contain ${imgClassName}`} muted autoPlay loop playsInline />
        // eslint-disable-next-line @next/next/no-img-element
        : <img src={src} alt={alt} loading={eager ? "eager" : "lazy"} className={`relative h-full w-full object-contain ${imgClassName}`} />}
    </div>
  );
}
