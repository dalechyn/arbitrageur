import { DeployFunction } from 'hardhat-deploy/types'
import { HardhatRuntimeEnvironment } from 'hardhat/types'

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre
  const { deploy } = deployments
  const { deployer } = await getNamedAccounts()

  await deploy('Arbitrageur', {
    from: deployer,
    args: [
      '0xE592427A0AEce92De3Edee1F18E0157C05861564',
      '0x7a250d5630b4cf539739df2c5dacb4c659f2488d'
    ],
    log: true,
    autoMine: true // speed up deployment on local network (ganache, hardhat), no effect on live networks
  })
}
export default func
func.tags = ['Arbitrageur']
