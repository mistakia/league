import { fileURLToPath } from 'url'

const is_main = (p) => process.argv[1] === fileURLToPath(p)

export default is_main
