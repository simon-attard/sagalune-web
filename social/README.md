# Social Profile Assets — Sagalune

Placeholder avatars for Instagram, TikTok, X, Threads, YouTube, Facebook, LinkedIn, Reddit, Pinterest.

Matches BRAND.md:
- Background: Forest Green `#2D6A4F`
- Letter: Amber Gold `#F4A261`, serif (Playfair Display target; Georgia fallback)
- 1:1 square, safe for circle cropping

## Files

| File | Purpose |
|---|---|
| `profile.svg` | Source vector. Edit this to regenerate. |
| `sagalune-profile-1024.png` | Universal default — upload to any platform, they'll auto-downsample. |
| `sagalune-profile-800.png` | YouTube (min 800×800). |
| `sagalune-profile-512.png` | Middle size, general fallback. |
| `sagalune-profile-400.png` | X, LinkedIn (recommended 400×400). |

## Which size to upload where

When in doubt, upload **`sagalune-profile-1024.png`** to every platform. All of them auto-resize. The smaller variants exist for tighter-spec platforms or bandwidth-sensitive uploads.

## To regenerate

```bash
for size in 400 512 800 1024; do
  qlmanage -t -s $size -o . profile.svg > /dev/null 2>&1
  mv profile.svg.png sagalune-profile-${size}.png
done
```

## Replace when the designer delivers

This is the **placeholder** mark. When the final logo is ready, swap out all of these with the designer's output and re-upload to each handle.
