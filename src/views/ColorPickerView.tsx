import { Box, Stack, Typography } from '@mui/material'

/// 取色器视图：放大镜 + 颜色展示
export default function ColorPickerView() {
  return (
    <Box
      data-testid="color-picker"
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        p: 1,
        borderRadius: 2,
        bgcolor: 'background.paper',
        boxShadow: 3,
      }}
    >
      <Box
        sx={{
          width: 48,
          height: 48,
          borderRadius: 1,
          border: '1px solid',
          borderColor: 'divider',
          bgcolor: '#000000',
        }}
      />
      <Stack spacing={0.5}>
        <Typography variant="body2" fontWeight="bold">
          #000000
        </Typography>
        <Typography variant="caption" color="text.secondary">
          rgb(0, 0, 0)
        </Typography>
      </Stack>
    </Box>
  )
}
