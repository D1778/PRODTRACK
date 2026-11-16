import { initials } from "../lib/format";

// Round-cornered picture, or the person's / business's initials when there is none.
export default function Avatar({ src, name, className = "", style }) {
  return (
    <span className={`avatar ${className}`.trim()} style={style}>
      {src ? <img src={src} alt="" /> : initials(name)}
    </span>
  );
}
