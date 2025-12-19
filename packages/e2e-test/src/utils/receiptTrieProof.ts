import { createMerkleProof, createMPT } from '@ethereumjs/mpt'
import { RLP } from '@ethereumjs/rlp'
import { TransactionType as TransactionTypeEthereumJs } from '@ethereumjs/tx'
import { concatBytes, hexToBytes, intToBytes } from '@ethereumjs/util'
import {
  bytesToHex,
  Hex,
  TransactionReceipt,
  TransactionType as TransactionTypeViem,
} from 'viem'

type BuildReceiptTrieArgs = {
  receipts: TransactionReceipt[]
  targetTxIndex: Hex
}

type BuildReceiptTrieReturn = {
  rootHash: Hex
  key: Hex
  proofNodes: Hex[]
}

/**
 * Convert a viem TransactionReceipt to ethereumjs TxReceipt format
 * and encode it for the receipt trie
 */
function encodeViemReceipt(receipt: TransactionReceipt): Uint8Array {
  const typeMap: Record<TransactionTypeViem, TransactionTypeEthereumJs> = {
    legacy: TransactionTypeEthereumJs.Legacy,
    eip2930: TransactionTypeEthereumJs.AccessListEIP2930,
    eip1559: TransactionTypeEthereumJs.FeeMarketEIP1559,
    eip4844: TransactionTypeEthereumJs.BlobEIP4844,
    eip7702: TransactionTypeEthereumJs.EOACodeEIP7702,
  }

  const txType = typeMap[receipt.type] ?? 0

  const logs = receipt.logs.map((log) => [
    log.address,
    log.topics.map((topic) => topic),
    log.data,
  ])

  const encoded = RLP.encode([
    // zk-wormholes are transactions after byzantium upgrade so status field exists
    receipt.status === 'success' ? Uint8Array.from([1]) : Uint8Array.from([]),
    hexToBytes(receipt.cumulativeGasUsed as any as Hex),
    hexToBytes(receipt.logsBloom),
    logs,
  ])

  return concatBytes(intToBytes(txType), encoded)
}

export async function buildReceiptTrie({
  receipts,
  targetTxIndex,
}: BuildReceiptTrieArgs): Promise<BuildReceiptTrieReturn> {
  const trie = await createMPT()

  for (const receipt of receipts) {
    const key = RLP.encode(receipt.transactionIndex)
    const value = encodeViemReceipt(receipt)

    await trie.put(key, value)
  }

  const trieRoot = bytesToHex(trie.root())

  // Convert target transaction index to RLP-encoded key
  const targetTxIndexNum = Number(targetTxIndex)
  const targetKey = RLP.encode(targetTxIndexNum)
  const proof = await createMerkleProof(trie, targetKey)

  return {
    rootHash: trieRoot,
    key: bytesToHex(targetKey),
    proofNodes: proof.map((node) => bytesToHex(node)),
  }
}
