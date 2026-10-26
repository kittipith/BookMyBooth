import { useNavigate } from 'react-router'
import { useAccountProfile, useAuth } from '../../hooks/useAuth'
import { useToast } from '../../hooks/useToast'
import ConfirmDialog from './ConfirmDialog'

interface LogoutDialogProps {
  open: boolean
  onClose: () => void
}

/** popup ยืนยันการออกจากระบบ */
export default function LogoutDialog({ open, onClose }: LogoutDialogProps) {
  const navigate = useNavigate()
  const { logout } = useAuth()
  const profile = useAccountProfile()
  const toast = useToast()

  return (
    <ConfirmDialog
      open={open}
      title="ออกจากระบบ"
      message={`ออกจากบัญชี ${profile?.name ?? ''}${profile?.org ? ` (${profile.org})` : ''} การจองที่กรอกค้างไว้และยังไม่ได้ส่งจะถูกล้าง`}
      confirmLabel="ออกจากระบบ"
      onClose={onClose}
      onConfirm={() => {
        onClose()
        logout()
        toast('ออกจากระบบแล้ว')
        navigate('/')
      }}
    />
  )
}
