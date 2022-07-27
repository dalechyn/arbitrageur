import { DeployFunction } from 'hardhat-deploy/types'

import { HardhatRuntimeEnvironment } from 'hardhat/types'

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const {
    deployments: { deterministic },
    getNamedAccounts
  } = hre
  const { deployer } = await getNamedAccounts()

  const { deploy, address } = await deterministic('MulticallTickLens', {
    from: deployer,
    salt: '0xb5eb0f0e1d4a43b5c55cd18661c10bcc8e50717cc26f692e2a9c863364902bec',
    args: ['0xbfd8137f7d1516d3ea5ca83523914859ec47f573'],
    log: true
  })
  console.log('Will deploy to', address)
  await deploy()
}
export default func
func.tags = ['MulticallTickLens']
