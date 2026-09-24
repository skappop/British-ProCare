import { getContainers } from '../../data'
import ContainerStickers from './ContainerStickers'

export const dynamic = 'force-dynamic'

/** One sticker per container: its name and a QR code that opens its check. */
export default async function ContainerLabelsPage() {
  const { containers } = await getContainers()
  return <ContainerStickers containers={containers.map((c) => ({ id: c.id, name: c.name, items: c.items.length }))} />
}
