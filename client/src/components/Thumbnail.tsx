import { memo } from 'react';

interface ThumbnailProps {
  url?: string;
  alt: string;
}

const Thumbnail = memo(({ url, alt }: ThumbnailProps) => {
  return (
    <div className="file-thumbnail">
      <div
        className="thumbnail-placeholder"
        style={url ? {
          backgroundImage: `url(${url})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center'
        } : {}}
        role="img"
        aria-label={alt}
      />
    </div>
  );
});

Thumbnail.displayName = 'Thumbnail';

export default Thumbnail;
