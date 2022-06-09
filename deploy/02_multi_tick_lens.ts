import { DeployFunction } from 'hardhat-deploy/types'
import { HardhatRuntimeEnvironment } from 'hardhat/types'

const TickLensAddresses: Record<string, string> = {
  5: '0xbfd8137f7d1516d3ea5ca83523914859ec47f573'
}

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts, getChainId } = hre
  const { deploy } = deployments
  const { deployer } = await getNamedAccounts()

  await deploy('MulticallTickLens', {
    from: deployer,
    args: [TickLensAddresses[await getChainId()] ?? '0xbfd8137f7d1516d3ea5ca83523914859ec47f573'],
    log: true,
    autoMine: true // speed up deployment on local network (ganache, hardhat), no effect on live networks
  })
}
export default func
func.tags = ['MulticallTickLens']
