import { fileURLToPath } from 'url'

const isMain = (p) => process.argv[1] === fileURLToPath(p)

export default isMain
