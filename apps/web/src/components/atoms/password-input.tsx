"use client"
import { InputGroup, InputGroupButton, InputGroupInput } from "@/src/components/ui/input-group"
import { EyeIcon, EyeOffIcon } from "lucide-react"
import { useState } from "react"

type PasswordInputProps = React.ComponentProps<"input">

const PasswordInput = ({ ...props }: PasswordInputProps) => {
	const [showPassword, setShowPassword] = useState(false)

	const handleShowPasswordToggle = () => {
		setShowPassword(!showPassword)
	}

	return (
		<InputGroup>
			<InputGroupInput {...props} type={showPassword ? "text" : "password"} />
			<InputGroupButton
				variant="ghost"
				size="icon-sm"
				className="hover:bg-transparent cursor-pointer"
				onClick={handleShowPasswordToggle}
			>
				{showPassword ? <EyeOffIcon className="size-4" /> : <EyeIcon className="size-4" />}
			</InputGroupButton>
		</InputGroup>
	)
}

export default PasswordInput
