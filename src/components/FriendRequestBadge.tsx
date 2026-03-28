interface Props {
  count: number
}

/** Badge shown on the Friends tab in BottomNav when there are pending incoming friend requests. */
export function FriendRequestBadge({ count }: Props) {
  if (count <= 0) return null
  return (
    <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
      {count > 9 ? '9+' : count}
    </span>
  )
}
