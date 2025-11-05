import { ImageResponse } from 'next/og';
import { fitCoordinates } from '@/lib/atlas/layout';
import { nearestNeighbors } from '@/lib/atlas/neighbors';
import { getServerBundle } from '@/lib/atlas/server';

export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const alt = 'Star Wars Semantic Atlas: PCA map of 15 character descriptions';

// Social card drawn from the real PCA coordinates of the shipped bundle.
export default async function OpengraphImage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const { atlas } = await getServerBundle();
  const model = atlas.manifest.model.id.split('/').pop();
  const data = atlas.modes.authored;
  const pca = data.projections.find((p) => p.id === 'pca')!;
  const pts = fitCoordinates(pca.coordinates_by_id, atlas.ids, 560, 470, 30);
  const top = new Set(nearestNeighbors(atlas.ids, data.matrix, 'luke-skywalker', 5).map((n) => n.id));
  const title = locale === 'es' ? '¿Por qué un modelo ve parecidos a dos personajes?' : 'Why does a model think two characters are alike?';
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', background: '#f2f0e9', color: '#172d46', padding: 56, fontFamily: 'sans-serif' }}>
        <div style={{ display: 'flex', flexDirection: 'column', width: 520, justifyContent: 'center' }}>
          <div style={{ fontSize: 26, color: '#577da5' }}>Star Wars Semantic Atlas</div>
          <div style={{ fontSize: 54, fontWeight: 700, lineHeight: 1.1, marginTop: 16 }}>{title}</div>
          <div style={{ fontSize: 24, marginTop: 24, color: '#4d5f73' }}>{locale === 'es' ? `15 descripciones · ${model} · paquete ${atlas.version}` : `15 descriptions · ${model} · bundle ${atlas.version}`}</div>
        </div>
        <div style={{ display: 'flex', position: 'relative', width: 560, height: 470, marginTop: 24, background: '#ffffff', borderRadius: 24, border: '3px solid #b8d5e9' }}>
          {atlas.ids.map((id) => {
            const p = pts[id]!;
            const isLuke = id === 'luke-skywalker';
            const r = isLuke ? 16 : top.has(id) ? 12 : 9;
            return (
              <div
                key={id}
                style={{
                  position: 'absolute',
                  left: p.x - r,
                  top: p.y - r,
                  width: r * 2,
                  height: r * 2,
                  borderRadius: r,
                  background: isLuke ? '#172d46' : top.has(id) ? '#577da5' : '#b8d5e9',
                  border: isLuke ? '4px solid #b8d5e9' : 'none',
                }}
              />
            );
          })}
        </div>
      </div>
    ),
    size,
  );
}
