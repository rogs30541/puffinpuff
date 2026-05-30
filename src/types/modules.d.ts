declare module 'ffprobe-static' {
  const value: string & { path: string };
  export default value;
}

declare module 'ffmpeg-static' {
  const value: string | null;
  export default value;
}
