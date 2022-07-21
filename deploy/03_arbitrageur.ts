import { DeployFunction } from 'hardhat-deploy/types'
import { HardhatRuntimeEnvironment } from 'hardhat/types'

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre
  const { deterministic } = deployments
  const { deployer } = await getNamedAccounts()

  const { deploy, address } = await deterministic('Arbitrageur', {
    from: deployer,
    salt: '0x15051d0239c659db6888f46fdf46871b86a7dbec954c9e8e4f66194f82e04521',
    args: [],
    log: true
  })
  console.log('Will deploy to', address)
  await deploy()
}
export default func
func.tags = ['Arbitrageur']
