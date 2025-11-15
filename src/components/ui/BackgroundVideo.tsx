export default function BackgroundVideo() {
  return (
    <>
      <video
        id="bg-video"
        className="bg-video"
        src="/video/title_smoke.mp4"
        autoPlay
        muted
        loop
        playsInline
        aria-hidden="true"
      />
      <div className="bg-vignette" aria-hidden="true" />
    </>
  );
}
