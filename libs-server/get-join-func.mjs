export default function get_join_func(join_type) {
  switch (join_type) {
    case 'LEFT':
      return 'leftJoin'
    case 'INNER':
      return 'innerJoin'
    default:
      return 'leftJoin'
  }
}
