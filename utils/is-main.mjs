import { fileURLToPath } from 'url'

const isMain = () => process.argv[1] === fileURLToPath(import.meta.url)

export default isMain
