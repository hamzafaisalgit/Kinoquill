import { useState } from "react";
import { Clapperboard } from "lucide-react";
import { tmdbImage } from "../../services/tmdb/images";
import type { ImageSize } from "../../services/tmdb/images";

function Artwork({
  src,
  title,
  backdrop,
}: {
  src: string | null;
  title: string;
  backdrop: boolean;
}) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  return (
    <div
      className={`poster-artwork ${backdrop ? "backdrop-artwork" : ""} ${!loaded && src && !failed ? "artwork-loading" : ""}`}
    >
      {src && !failed ? (
        <img
          src={src}
          alt={backdrop ? "" : `${title} poster`}
          loading="lazy"
          referrerPolicy="no-referrer"
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
          style={{ opacity: loaded ? 1 : 0 }}
        />
      ) : (
        <div
          className="poster-fallback"
          aria-label={
            backdrop ? undefined : `No artwork available for ${title}`
          }
        >
          <Clapperboard size={30} strokeWidth={1} />
          <span>KINOQUILL</span>
          <small>ARTWORK UNAVAILABLE</small>
        </div>
      )}
    </div>
  );
}
export function PosterArtwork({
  path,
  title,
  size = "w342",
  backdrop = false,
}: {
  path?: string | null;
  title: string;
  size?: ImageSize;
  backdrop?: boolean;
}) {
  const src = tmdbImage(path, size);
  return <Artwork key={src} src={src} title={title} backdrop={backdrop} />;
}
